import { useEffect, useRef, useState } from 'react';
import type { RoomView } from '@gostop/shared';
import { playSound } from '../lib/sound.ts';
import type { AnimationPhase } from '../lib/animationContext.ts';
import {
  FLIP_DURATION,
  FLY_DURATION_HAND_TO_FIELD,
  FLY_DURATION_TO_COLLECTED,
  FLY_TO_SLOT_DURATION,
  HAND_PEAK_DURATION,
  INTER_PHASE_DELAY,
  SCALE_PEAK_DURATION,
  sec,
} from '../lib/animationTiming.ts';
import type { Card } from '@gostop/shared';
import {
  buildPhase1View,
  buildPhase1ViewWithFakeHand,
  buildPhase3View,
  buildPhase4View,
  findDrawnCard,
  findHandCardsRemoved,
} from './turnSequence/phaseViews.ts';
import {
  makePhaseTag,
  plog,
  startPhaseLog,
} from './turnSequence/phaseLogger.ts';

/** Phase 3 sub-phase — floating overlay animate target 결정 */
export type FlippingPhase = 'flip' | 'peak' | 'fly' | null;

interface MultiTurnSequence {
  /** 화면에 표시할 view (staging 적용된 상태) */
  displayView: RoomView;
  /** Phase 1-A: 손패 카드를 그 자리에서 확대 */
  peakingHandCardId: string | null;
  /** Phase 3: 더미에서 막 뒤집힌 카드 — flip + 확대 효과 */
  flippingCardId: string | null;
  /** Phase 3 sub-phase — CenterField floating overlay animate target 결정 */
  flippingPhase: FlippingPhase;
  /** 현재 진행 중인 phase — Card layout transition duration이 phase별로 다름 */
  currentPhase: AnimationPhase;
  /** step 모드일 때 사용자 click 대기 중인 라벨. null이면 자동 진행 또는 비활성. */
  awaitingStep: string | null;
  /** 모달/Space 클릭 시 호출 — 다음 sub-phase 진행 */
  continueStep: () => void;
}

interface MultiTurnSequenceOptions {
  /** true면 각 sub-phase 사이 사용자 click 대기 (디버그). default false. */
  stepMode?: boolean;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * server broadcast → 4-phase 시퀀스로 진행.
 *
 *   Phase 1-A: 손패 카드 확대         (HAND_PEAK_DURATION)
 *   Phase 1-B: hand → field 비행      (FLY_DURATION_HAND_TO_FIELD, layoutId 자동)
 *   Phase 2:   착지 사운드             (Phase 1-B 시작과 동시)
 *   INTER:    단계 사이 대기           (INTER_PHASE_DELAY)
 *   Phase 3:  더미 flip + 확대 + 비행 (FLIP + SCALE_PEAK + FLY_TO_SLOT)
 *   Phase 4:  진짜 view swap          (FLY_DURATION_TO_COLLECTED, collected stagger)
 *
 * **sequential 보장**: 각 phase가 await sleep으로 완료 보장 후 다음 phase 진입.
 * **큐잉**: 시퀀스 진행 중 새 broadcast 도착 시 pendingViewRef에 저장 → 끝난 후 자동 처리.
 */
export function useMultiTurnSequence(
  view: RoomView,
  options: MultiTurnSequenceOptions = {},
): MultiTurnSequence {
  const stepMode = options.stepMode ?? false;

  const [displayView, setDisplayView] = useState<RoomView>(view);
  const [peakingHandCardId, setPeakingHandCardId] = useState<string | null>(null);
  const [flippingCardId, setFlippingCardId] = useState<string | null>(null);
  const [flippingPhase, setFlippingPhase] = useState<FlippingPhase>(null);
  const [currentPhase, setCurrentPhase] = useState<AnimationPhase>('idle');
  const [awaitingStep, setAwaitingStep] = useState<string | null>(null);

  const processingRef = useRef(false);
  const pendingViewRef = useRef<RoomView | null>(null);
  const lastProcessedRef = useRef<RoomView>(view);
  const stepResolverRef = useRef<(() => void) | null>(null);
  // 새 게임 인스턴스 시작 시 진행 중 sequence 중단 신호 — 각 await 후 체크.
  const abortRef = useRef(false);

  // step 모드일 때 sub-phase 끝마다 호출. 사용자가 continueStep 호출하면 promise resolve.
  function waitForStep(label: string): Promise<void> {
    if (!stepMode) return Promise.resolve();
    return new Promise<void>((resolve) => {
      stepResolverRef.current = resolve;
      setAwaitingStep(label);
    });
  }

  function continueStep(): void {
    const resolve = stepResolverRef.current;
    if (!resolve) return;
    stepResolverRef.current = null;
    setAwaitingStep(null);
    resolve();
  }

  useEffect(() => {
    const incoming = view;
    const last = lastProcessedRef.current;

    // 첫 mount 또는 다른 방 → 즉시 swap
    if (!last || last.roomId !== incoming.roomId) {
      setDisplayView(incoming);
      lastProcessedRef.current = incoming;
      return;
    }

    // 새 게임 인스턴스 → 시퀀스 X, 즉시 swap + 진행 중 step 모드 강제 해제.
    if (last.gameInstanceId !== incoming.gameInstanceId) {
      // 진행 중 sequence 있으면 abort + step 대기 promise resolve
      abortRef.current = true;
      if (stepResolverRef.current) {
        const resolve = stepResolverRef.current;
        stepResolverRef.current = null;
        resolve();
      }
      setAwaitingStep(null);
      setPeakingHandCardId(null);
      setFlippingCardId(null);
      setFlippingPhase(null);
      setCurrentPhase('idle');
      setDisplayView(incoming);
      lastProcessedRef.current = incoming;
      pendingViewRef.current = null;
      return;
    }

    // hand/drawn diff 검사 — prebuild view도 trigger 가능 (turnSeq 무관)
    // 폭탄 시 3장, 일반 시 1장. fallback (AI history)은 1장.
    const handCards = findHandCardsRemoved(last, incoming);
    const handCardId = handCards[0]?.id ?? null;
    const drawnCardId = findDrawnCard(last, incoming, handCardId);
    if (!handCardId && !drawnCardId) {
      // 변화 없음 (또는 collected diff만) → 즉시 swap (Phase 4 layoutId 자동)
      setDisplayView(incoming);
      lastProcessedRef.current = incoming;
      return;
    }

    // 이미 진행 중이면 pending에 저장 — 끝나면 자동 처리
    if (processingRef.current) {
      pendingViewRef.current = incoming;
      return;
    }

    void runSequenceLoop(incoming);
    // view 객체 자체 의존성 — turnSeq/flags/prebuild 변화 모두 감지
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  /** 큐가 빌 때까지 sequence 반복. abort 시 즉시 종료. */
  async function runSequenceLoop(firstIncoming: RoomView): Promise<void> {
    processingRef.current = true;
    abortRef.current = false;
    let target: RoomView | null = firstIncoming;
    while (target !== null && !abortRef.current) {
      const from = lastProcessedRef.current;
      const to = target;
      await runOneSequence(from, to);
      if (abortRef.current) break;
      lastProcessedRef.current = to;
      target = pendingViewRef.current;
      pendingViewRef.current = null;
    }
    processingRef.current = false;
    abortRef.current = false;
  }

  async function runOneSequence(prev: RoomView, incoming: RoomView): Promise<void> {
    if (abortRef.current) return;
    // 폭탄 발동 시 3장 (같은 month), 일반 시 1장. fallback (AI history)은 1장.
    const handCards = findHandCardsRemoved(prev, incoming);
    const handCardId = handCards[0]?.id ?? null;
    const drawnCardId = findDrawnCard(prev, incoming, handCardId);

    if (!handCardId && !drawnCardId) {
      setDisplayView(incoming);
      return;
    }

    // sequence 시작 시점 — prev 유지 (Phase 1-A peak 효과)
    setDisplayView(prev);

    const seq = incoming.turnSeq ?? 0;
    const turnUser =
      incoming.players.find((p) => p.userId === prev.turnUserId)?.nickname ?? '?';
    const isMyTurn = prev.turnUserId === incoming.myUserId;
    const tag = makePhaseTag(seq, isMyTurn, turnUser);

    startPhaseLog();
    plog(
      tag,
      `▶ seq START — handCards=${handCards.map((c) => c.id).join(',') || 'none'}, drawnCard=${drawnCardId ?? 'none'}`,
    );

    // 폭탄 보너스 카드 (Card.isBomb=true) — 손에서만 제거, field 변화 X.
    // 일반 카드는 buildPhase1View로 field에 추가.
    const isBombBonusCard =
      handCards.length === 1 && handCards[0]?.isBomb === true;
    const phase1View =
      handCards.length === 0
        ? prev
        : isBombBonusCard
          ? {
              ...prev,
              players: prev.players.map((p) =>
                p.userId === prev.myUserId
                  ? {
                      ...p,
                      hand: (p.hand ?? []).filter((c) => c.id !== handCards[0]!.id),
                    }
                  : p,
              ),
            }
          : buildPhase1View(prev, handCards);
    // AI/상대 turn Phase 1-A에서 OpponentSlot에 fake hand source motion.div mount.
    // Phase 1-B에서 phase1View로 swap 시 hand → field layoutId 비행.
    const phase1ViewFake =
      !isMyTurn && handCards.length > 0
        ? buildPhase1ViewWithFakeHand(prev, handCards)
        : null;
    const phase3View = drawnCardId
      ? buildPhase3View(phase1View, drawnCardId, incoming)
      : phase1View;

    // alreadyInField 검사 — 시각효과 중복 방지.
    //   handAlreadyInField: handCard가 prev.field에 이미 있음 (모달 후 broadcast 또는 server bug).
    //                       Phase 1 시각효과/사운드 skip — prebuild에서 이미 처리.
    //   drawnAlreadyInField: drawnCard가 prev.field에 이미 있음 (server bug 또는 stuck).
    //                        Phase 3 floating overlay skip — 일반 매핑 카드 그대로 표시.
    const handAlreadyInField =
      handCards.length > 0 &&
      handCards.every((c) => prev.field.some((f) => f.id === c.id));
    const drawnAlreadyInField = drawnCardId
      ? prev.field.some((c) => c.id === drawnCardId)
      : false;

    // 폭탄 발동 여부 — server lastTurnSpecials.bomb으로 판단 (본인/AI 동일 처리)
    const isBombFire = incoming.lastTurnSpecials?.bomb === true;

    if (handCardId && handCards.length > 0 && !isBombBonusCard) {
      await runPhase1(
        tag,
        handCards,
        phase1View,
        phase1ViewFake,
        isMyTurn,
        handAlreadyInField,
        isBombFire,
      );
      if (abortRef.current) return;
    } else {
      plog(
        tag,
        `· Phase 1 skip (${isBombBonusCard ? '폭탄 보너스 카드' : '손패 변화 X'})`,
      );
      setDisplayView(phase1View);
    }

    if (drawnCardId) {
      await runPhase3(tag, drawnCardId, phase3View, drawnAlreadyInField);
      if (abortRef.current) return;
    } else {
      plog(tag, `· Phase 3 skip (더미 X)`);
    }

    await runPhase4(tag, incoming);
    if (abortRef.current) return;

    plog(tag, `■ seq END → idle`);
    setCurrentPhase('idle');
    // 다음 sequence가 같은 batch에 진입하면 phase=idle render frame을 건너뛰어
    // useMultiSpecialsTrigger가 trigger 발화 못 함. sleep(0)으로 batch 분리 →
    // idle render 보장 → effects 실행 → trigger.
    await sleep(0);
  }

  /**
   * Phase 1: 손패 카드 확대 (1-A) → 손패→field 비행 + 착지 사운드 (1-B) → INTER 대기.
   *
   * - 본인 turn: peakingHandCardId 로 MyHand 카드 확대 → phase1View로 swap (layoutId 비행).
   * - AI/상대 turn: phase1ViewFake 로 OpponentSlot에 fake hand 카드 mount → phase1View로
   *   swap 시 layoutId 비행 (OpponentSlot → 바닥).
   */
  async function runPhase1(
    tag: string,
    handCards: Card[],
    phase1View: RoomView,
    phase1ViewFake: RoomView | null,
    isMyTurn: boolean,
    handAlreadyInField: boolean,
    isBombFire: boolean,
  ): Promise<void> {
    setCurrentPhase('phase1');
    // Phase 1-A peak는 사용자가 클릭한 카드(handCards[0])만 — 폭탄이라도 1장만 확대
    // Phase 1-B에서는 handCards 모두 (3장이면 3장 다) 손→바닥 비행
    const peakCardId = handCards[0]?.id ?? '';

    // ---- Phase 1-A ----
    plog(tag, `▶ Phase 1-A 시작 (peak ${HAND_PEAK_DURATION}s) — ${peakCardId}${handCards.length > 1 ? ` (+${handCards.length - 1} 폭탄)` : ''}`);
    if (!handAlreadyInField) {
      // alreadyInField=true이면 시각효과 skip (prebuild에서 이미 처리됨 또는 server bug)
      if (isMyTurn) {
        setPeakingHandCardId(peakCardId);
      } else if (phase1ViewFake) {
        // AI/상대 turn — OpponentSlot에 layoutId source motion.div mount
        setDisplayView(phase1ViewFake);
      }
    }
    await sleep(sec(HAND_PEAK_DURATION));
    if (isMyTurn) setPeakingHandCardId(null);
    plog(tag, `✓ Phase 1-A 완료`);

    // ---- Phase 1-B: view swap + layoutId 비행 → 도착 시 착지 사운드 (Phase 2) ----
    plog(tag, `▶ Phase 1-B 시작 (view swap + fly ${FLY_DURATION_HAND_TO_FIELD}s)`);
    setDisplayView(phase1View);
    await sleep(sec(FLY_DURATION_HAND_TO_FIELD));
    if (!handAlreadyInField) {
      // 사운드도 alreadyInField 시 skip — 모달 후 broadcast 처리 시 중복 재생 방지.
      // 폭탄 발동 (server lastTurnSpecials.bomb=true) — 'boom' 사운드 (본인/AI 동일).
      if (isBombFire) {
        playSound('boom');
        plog(tag, `  ▷ Phase 2 폭탄 사운드 (boom.mp3)`);
      } else {
        playSound('card-place');
        plog(tag, `  ▷ Phase 2 착지 사운드 (card-place.mp3)`);
      }
    } else {
      plog(tag, `  ▷ Phase 2 사운드 skip (handCard alreadyInField)`);
    }
    plog(tag, `✓ Phase 1-B 완료`);

    // ---- INTER_PHASE_DELAY ----
    plog(tag, `▶ INTER_PHASE_DELAY 시작 (${INTER_PHASE_DELAY}s)`);
    await sleep(sec(INTER_PHASE_DELAY));
    if (abortRef.current) return;
    plog(tag, `✓ INTER_PHASE_DELAY 완료`);
    // Phase 1-A/1-B/INTER는 하나의 묶음으로 자동 진행 — 끝에서만 click 대기
    await waitForStep('Phase 1 전체 완료 → Phase 3-A 시작');
  }

  /**
   * Phase 3: 더미 카드 3D flip → 확대 유지 → 빈 슬롯으로 축소 비행.
   *
   * phase3View로 swap해서 drawnCard를 field에 추가. 일반 매핑 motion.div는
   * flippingCardId === card.id 검사로 opacity 0 처리, floating overlay가 시각효과 담당.
   */
  async function runPhase3(
    tag: string,
    drawnCardId: string,
    phase3View: RoomView,
    drawnAlreadyInField: boolean,
  ): Promise<void> {
    setCurrentPhase('phase3');
    setDisplayView(phase3View);
    if (!drawnAlreadyInField) {
      // alreadyInField=true (drawnCard가 이미 field에 있음 — server bug 또는 stuck)
      // 시각효과 skip — 일반 매핑 카드 그대로 표시 (사라짐 방지)
      setFlippingCardId(drawnCardId);
    } else {
      plog(tag, `  ▷ floating overlay skip (drawnCard alreadyInField=${drawnCardId})`);
    }

    // Phase 3-A: rotateY 180 → 0 (flip만, 위치/scale 변화 X)
    setFlippingPhase('flip');
    plog(tag, `▶ Phase 3-A flip 시작 (${FLIP_DURATION}s) — ${drawnCardId}`);
    await sleep(sec(FLIP_DURATION));
    if (abortRef.current) return;
    plog(tag, `✓ Phase 3-A flip 완료`);
    await waitForStep('Phase 3-A flip 완료 → 3-B peak 시작');
    if (abortRef.current) return;

    // Phase 3-B: scale 1 → 2 (확대, 위치/rotateY 유지)
    setFlippingPhase('peak');
    plog(tag, `▶ Phase 3-B peak 시작 (${SCALE_PEAK_DURATION}s)`);
    await sleep(sec(SCALE_PEAK_DURATION));
    if (abortRef.current) return;
    plog(tag, `✓ Phase 3-B peak 완료`);
    await waitForStep('Phase 3-B peak 완료 → 3-C fly 시작');
    if (abortRef.current) return;

    // Phase 3-C: 슬롯 위치로 이동 + scale 2 → 1 (축소 비행)
    setFlippingPhase('fly');
    plog(tag, `▶ Phase 3-C fly 시작 (${FLY_TO_SLOT_DURATION}s)`);
    await sleep(sec(FLY_TO_SLOT_DURATION));
    setFlippingCardId(null);
    setFlippingPhase(null);
    // 더미 카드가 슬롯에 도착하는 시점에도 착지 사운드 (Phase 1-B 끝과 동일 효과)
    playSound('card-place');
    plog(tag, `  ▷ Phase 3 착지 사운드 (card-place.mp3)`);
    plog(tag, `✓ Phase 3-C fly 완료`);
    await waitForStep('Phase 3-C 완료 → Phase 4 시작');
  }

  /**
   * Phase 4: 진짜 incoming view로 swap → 매칭 카드들 collected로 layoutId 비행.
   *
   * Card.tsx의 transition.layout.duration이 phase='phase4'일 때
   * applySpeed(FLY_DURATION_TO_COLLECTED) 적용됨.
   */
  async function runPhase4(tag: string, incoming: RoomView): Promise<void> {
    plog(
      tag,
      `▶ Phase 4 시작 (view swap → collected stagger, ${FLY_DURATION_TO_COLLECTED}s)`,
    );
    setCurrentPhase('phase4');
    // 빼앗은 카드는 Phase 5에서 비행 — Phase 4에서는 매칭 카드만 본인 collected로.
    const phase4View = buildPhase4View(incoming);
    setDisplayView(phase4View);
    await sleep(sec(FLY_DURATION_TO_COLLECTED));
    plog(tag, `✓ Phase 4 완료`);

    // Phase 5: 빼앗기 (stealPiCards) — 상대 collected → 본인 collected 비행.
    // stealPiCards 없으면 즉시 incoming swap (변화 X).
    const stealCount = incoming.lastTurnSpecials?.stealPiCards?.length ?? 0;
    if (stealCount > 0) {
      plog(tag, `▶ Phase 5 시작 (빼앗기 ${stealCount}장, ${FLY_DURATION_TO_COLLECTED}s)`);
      await waitForStep('Phase 4 완료 → Phase 5 (빼앗기) 시작');
      setDisplayView(incoming);
      await sleep(sec(FLY_DURATION_TO_COLLECTED));
      plog(tag, `✓ Phase 5 완료`);
    } else {
      // 빼앗기 없으면 그냥 incoming swap (phase4View와 동일하지만 안전)
      setDisplayView(incoming);
    }
  }

  return {
    displayView,
    peakingHandCardId,
    flippingCardId,
    flippingPhase,
    currentPhase,
    awaitingStep,
    continueStep,
  };
}
