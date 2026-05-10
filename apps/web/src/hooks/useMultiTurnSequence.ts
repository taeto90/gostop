import { useEffect, useRef, useState } from 'react';
import type { Card, RoomView } from '@gostop/shared';
import { playSound } from '../lib/sound.ts';
import type { AnimationPhase } from '../lib/animationContext.ts';
import {
  FLIP_DURATION,
  FLY_DURATION_HAND_TO_FIELD,
  FLY_TO_SLOT_DURATION,
  HAND_PEAK_DURATION,
  INTER_PHASE_DELAY,
  SCALE_PEAK_DURATION,
} from '../lib/animationTiming.ts';

interface MultiTurnSequence {
  /** 화면에 표시할 view (staging 적용된 상태) */
  displayView: RoomView;
  /** Phase 1-A: 손패 카드를 그 자리에서 확대 */
  peakingHandCardId: string | null;
  /** Phase 3: 더미에서 막 뒤집힌 카드 — flip + 확대 효과 */
  flippingCardId: string | null;
  /** 현재 진행 중인 phase — Card layout transition duration이 phase별로 다름 */
  currentPhase: AnimationPhase;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const sec = (s: number) => Math.round(s * 1000);

/**
 * server broadcast 받았을 때 4-phase 시퀀스로 진행.
 *
 * - Phase 1-A: 손패 카드 확대 (HAND_PEAK_DURATION)
 * - Phase 1-B: 손패 → 바닥 비행 (FLY_DURATION_HAND_TO_FIELD) — framer-motion layoutId 자동
 * - Phase 2: 착지 사운드 (card-place)
 * - Phase 3: 더미 카드 flip + 확대 + 비행 (FLIP + SCALE_PEAK + FLY_TO_SLOT)
 * - Phase 4: collected stagger — layoutId 자동 (별도 staging X)
 *
 * `view.turnSeq` 변경 시점에 시퀀스 시작. 시퀀스 동안 stagedView를 prev로 유지하다가 단계별로 incoming view로 swap.
 */
export function useMultiTurnSequence(view: RoomView): MultiTurnSequence {
  const [displayView, setDisplayView] = useState<RoomView>(view);
  const [peakingHandCardId, setPeakingHandCardId] = useState<string | null>(null);
  const [flippingCardId, setFlippingCardId] = useState<string | null>(null);
  const [currentPhase, setCurrentPhase] = useState<AnimationPhase>('idle');
  const seqIdRef = useRef(0);
  // 직전 sequence가 끝난 시점의 view (stale closure 회피)
  const prevViewRef = useRef<RoomView>(view);

  useEffect(() => {
    const incoming = view;
    const prev = prevViewRef.current;
    // 같은 turn (broadcast 변경 X) → 즉시 적용
    if (
      !prev ||
      prev.roomId !== incoming.roomId ||
      (prev.turnSeq ?? 0) === (incoming.turnSeq ?? 0)
    ) {
      setDisplayView(incoming);
      prevViewRef.current = incoming;
      return;
    }

    const myId = ++seqIdRef.current;

    // Diff 계산
    const handCardId = findHandCardRemoved(prev, incoming);
    const drawnCardId = findDrawnCard(prev, incoming, handCardId);

    if (!handCardId && !drawnCardId) {
      // 변화 없음 — 즉시 적용
      setDisplayView(incoming);
      prevViewRef.current = incoming;
      return;
    }

    // prev view 유지 — sequence 진행 동안 화면은 이전 상태로 보임.
    // sequence 끝나면 incoming으로 전환.
    setDisplayView(prev);
    // 다음 broadcast 도착 시 prev 비교용 — 즉시 update (cancellation 대응)
    prevViewRef.current = incoming;

    let cancelled = false;
    void (async () => {
      // Phase 1: 손패 → 바닥 (peak + fly). Card 컴포넌트가 phase1 layout duration 사용.
      setCurrentPhase('phase1');
      if (handCardId) {
        setPeakingHandCardId(handCardId);
        await sleep(sec(HAND_PEAK_DURATION));
        if (cancelled || seqIdRef.current !== myId) return;
        setPeakingHandCardId(null);
      }

      // Phase 2: 착지 사운드 + incoming view 적용 → layoutId 보간 시작
      // Phase 1-B의 별도 sleep은 제거 — view swap 시점에 framer-motion layout이 0.3초간 보간.
      // sleep을 view swap 전에 두면 사용자가 손패 카드를 더 오래 보지만 보간 시작이 늦음.
      playSound('card-place');
      setDisplayView(incoming);
      await sleep(sec(FLY_DURATION_HAND_TO_FIELD + INTER_PHASE_DELAY));
      if (cancelled || seqIdRef.current !== myId) return;

      // Phase 3: 더미 카드 뒤집기 + 확대 + 비행
      if (drawnCardId) {
        setCurrentPhase('phase3');
        setFlippingCardId(drawnCardId);
        await sleep(sec(FLIP_DURATION + SCALE_PEAK_DURATION + FLY_TO_SLOT_DURATION));
        if (cancelled || seqIdRef.current !== myId) return;
        setFlippingCardId(null);
      }
      setCurrentPhase('idle');
    })();

    return () => {
      cancelled = true;
    };
    // phase는 'waiting' → 'playing' 전환 시 turnSeq가 변하지 않을 수 있어 별도로 감지.
    // deckCount/players로도 broadcast 변화 감지 (게임 진행 중 패 분배 등 turnSeq 외 변화).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.turnSeq, view.roomId, view.phase, view.deckCount]);

  return { displayView, peakingHandCardId, flippingCardId, currentPhase };
}

/**
 * prev → incoming 비교해서 본인 손패에서 빠진 카드 ID 반환.
 * 본인이 카드 안 냈거나 hand가 undefined면 null.
 */
function findHandCardRemoved(
  prev: RoomView,
  incoming: RoomView,
): string | null {
  const prevMe = prev.players.find((p) => p.userId === prev.myUserId);
  const incomingMe = incoming.players.find((p) => p.userId === incoming.myUserId);
  if (!prevMe?.hand || !incomingMe?.hand) return null;
  const incomingIds = new Set(incomingMe.hand.map((c) => c.id));
  for (const c of prevMe.hand) {
    if (!incomingIds.has(c.id)) return c.id;
  }
  return null;
}

/**
 * 더미에서 뒤집힌 카드 — incoming.field에 새로 추가된 카드 중 손패 카드가 아닌 것.
 * 단, 매칭된 카드는 collected로 가서 field에 없을 수 있음 → field/collected 모두 체크.
 */
function findDrawnCard(
  prev: RoomView,
  incoming: RoomView,
  excludeId: string | null,
): string | null {
  if (prev.deckCount <= incoming.deckCount) return null;
  // deck 감소 = 더미에서 1장 뽑힘. 어디로 갔는지 찾기.
  const prevFieldIds = new Set(prev.field.map((c) => c.id));
  const newFieldCards: Card[] = incoming.field.filter(
    (c) => !prevFieldIds.has(c.id) && c.id !== excludeId,
  );
  if (newFieldCards.length > 0) {
    // 마지막 = 더미 뒤집기 (손패는 그 전 단계)
    return newFieldCards[newFieldCards.length - 1]!.id;
  }
  // 더미 카드가 매칭으로 collected 갔으면 — 모든 player collected에서 추가된 것 중 손패 X
  for (const p of incoming.players) {
    const prevP = prev.players.find((pp) => pp.userId === p.userId);
    if (!prevP) continue;
    const prevCollectedIds = new Set(prevP.collected.map((c) => c.id));
    const added = p.collected.filter(
      (c) => !prevCollectedIds.has(c.id) && c.id !== excludeId,
    );
    // 마지막 추가 카드 = 더미 카드일 확률 높음
    if (added.length > 0) return added[added.length - 1]!.id;
  }
  return null;
}
