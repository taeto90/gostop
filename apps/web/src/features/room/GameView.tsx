import { LayoutGroup } from 'framer-motion';
import { AnimationPhaseContext } from '../../lib/animationContext.ts';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAfkDetect } from '../../hooks/useAfkDetect.ts';
import { useAnyTurnCountdown } from '../../hooks/useAnyTurnCountdown.ts';
import { useMultiPlayCard } from '../../hooks/useMultiPlayCard.ts';
import { useMultiSpecialsTrigger } from '../../hooks/useMultiSpecialsTrigger.ts';
import { useMultiTurnSequence } from '../../hooks/useMultiTurnSequence.ts';
import { useShakeBombFireTrigger } from '../../hooks/useShakeBombFireTrigger.ts';
import { useChongtongFireTrigger } from '../../hooks/useChongtongFireTrigger.ts';
import { toast } from '../../stores/toastStore.ts';
import type { PresetId, RoomView } from '@gostop/shared';
import { getMatchableCardsFromHand, PRESETS } from '@gostop/shared';
import { TargetPickerModal } from './game-ui/TargetPickerModal.tsx';
import {
  BombChoiceModal,
  ShakeDecisionModal,
} from './game-ui/ShakeDecisionModal.tsx';
import { NineYeolPickerModal } from './game-ui/NineYeolPickerModal.tsx';
import { GoStopModal } from './game-ui/GoStopModal.tsx';
import { useNineYeolDecision } from '../../hooks/useNineYeolDecision.ts';
import { PRESET_LABELS } from './RoomLobbyModal.tsx';
import { computeMultiplier, multiplierBreakdown } from '../../lib/multiplierUtils.ts';
import { useElementSize } from '../../hooks/useElementSize.ts';
import { ChatPanel } from '../../components/ChatPanel.tsx';
import { EmojiReactions } from '../../components/EmojiReactions.tsx';
import { SettingsModal } from '../../components/SettingsModal.tsx';
import { emitWithAck } from '../../lib/socket.ts';
import { useChatStore } from '../../stores/chatStore.ts';
import { ANIMATION_SPEED_OPTIONS, useDevTestStore } from '../../stores/devTestStore.ts';
import {
  COLLECTED_PANEL_WIDTH,
  HAND_AREA_MAX,
  HAND_AREA_MIN,
  HAND_AREA_RATIO,
  isCompactWidth,
} from '../../lib/layoutConstants.ts';
import { HAND_PEAK_DURATION, sec } from '../../lib/animationTiming.ts';
import { CenterField } from './game-ui/CenterField.tsx';
import { CompactHeader } from './game-ui/CompactHeader.tsx';
import { MobileCollected } from './game-ui/MobileCollected.tsx';
import { MyHand } from './game-ui/MyHand.tsx';
import { OpponentSlot, type OpponentMenuActions } from './game-ui/OpponentSlot.tsx';
import { RoomRulesModal } from './RoomRulesModal.tsx';
import { HostRulesAction, PlayerActions } from './GameSettingsActions.tsx';

interface GameViewProps {
  view: RoomView;
  onPlayCard: (cardId: string) => void | Promise<void>;
  onLeave: () => void | Promise<void>;
  badge?: string;
  /** Phase 3에서 새로 등장하는 더미 카드 ID — flip + scale 효과 적용 */
  flippingCardId?: string | null;
  /** Phase 1-A에서 손패 자리에서 확대 중인 카드 ID */
  peakingHandCardId?: string | null;
  /** PC에서 우측 grid에 들어갈 화상 사이드바 — LiveKit context 안의 컴포넌트 */
  videoSidebar?: React.ReactNode;
  /** 모바일 화상 모달 — open/onClose 받아 풀스크린 모달 렌더 */
  videoMobileModalRender?: (props: {
    open: boolean;
    onClose: () => void;
  }) => React.ReactNode;
  /** 설정 모달의 카메라/마이크 토글 섹션 (LiveKit context 의존) */
  mediaSettings?: React.ReactNode;
}

export function GameView({
  view,
  onPlayCard,
  onLeave,
  badge,
  flippingCardId,
  peakingHandCardId: peakingFromProps,
  videoSidebar,
  videoMobileModalRender,
  mediaSettings,
}: GameViewProps) {
  // 멀티 모드: 본인 카드 클릭 시 잠시 확대 효과 (Phase 1 부분 적용).
  // 솔로(SoloPlay)는 props로 명시 전달, 멀티는 클라 단독으로 짧게 표시.
  const [localPeakingId, setLocalPeakingId] = useState<string | null>(null);
  const peakingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // rules-final.md §4 — 흔들기/폭탄 게임 도중 모달 state
  const [pendingShake, setPendingShake] = useState<
    | { cardId: string; month: number; cards: import('@gostop/shared').Card[] }
    | null
  >(null);
  const [pendingBomb, setPendingBomb] = useState<
    | {
        cardId: string;
        month: number;
        handCards: import('@gostop/shared').Card[];
        fieldCard: import('@gostop/shared').Card;
      }
    | null
  >(null);
  const [rootRef, { width: rootW, height: rootH }] = useElementSize<HTMLDivElement>();
  const isCompact = isCompactWidth(rootW);
  // 손패 영역 높이 — 화면 height 비율 기반 (lib/layoutConstants 에서 조절).
  const handRatio =
    rootH > 0 && rootH < 400
      ? HAND_AREA_RATIO.shortMobile
      : isCompact
        ? HAND_AREA_RATIO.mobile
        : HAND_AREA_RATIO.pc;
  const handMaxLimit = isCompact ? HAND_AREA_MAX.mobile : HAND_AREA_MAX.pc;
  const handMin = Math.max(HAND_AREA_MIN, Math.min(handMaxLimit, rootH * handRatio));
  const handMax = Math.max(handMin, handMaxLimit + 20);

  const [settingsOpen, setSettingsOpen] = useState(false);
  // 테스트 모드 한정 — 화면 상단 컨트롤 5개(좌측 시나리오 3개 + 우측 로비/설정 2개) hide/show 토글
  const [testControlsVisible, setTestControlsVisible] = useState(true);

  // dev 디버그 — `window.__view`로 RoomView 직접 검사. flags/players 등 검증용
  if (typeof window !== 'undefined') {
    (window as unknown as { __view?: RoomView }).__view = view;
  }
  const [rulesOpen, setRulesOpen] = useState(false);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const chatUnread = useChatStore((s) => s.unreadCount);
  const isHost = view.hostUserId === view.myUserId;

  // AFK 감지 — turn 시작 후 30초+ 응답 없으면 해당 userId 표시
  const afkUserId = useAfkDetect(view.turnUserId);
  // 멀티 모드 play-card emit + needsSelection 응답 처리.
  // 모달은 Phase 3 후 발화 — prebuild view로 손패+더미가 바닥에 placed된 상태 시각화.
  const myPlayerForEmit = view.players.find((p) => p.userId === view.myUserId);
  const {
    pendingPick: pendingMultiPick,
    prebuildView,
    emitPlayCard: emitPlayCardMulti,
    handlePick: handleMultiPick,
    cancelPick: cancelMultiPick,
  } = useMultiPlayCard(myPlayerForEmit, view);

  // useMultiTurnSequence의 input — prebuild가 있으면 그것을 처리해 Phase 1~3 재생.
  // server broadcast 도착 시 useMultiPlayCard가 prebuild clear → 진짜 view로 전환.
  const inputView = prebuildView ?? view;
  // step 모드 토글 (testMode + 호스트일 때만 노출). default ON — 현재 디버깅 흐름 유지.
  const [stepModeEnabled, setStepModeEnabled] = useState(true);
  const stepMode =
    (view.testMode ?? false) &&
    view.hostUserId === view.myUserId &&
    stepModeEnabled;
  // 4-phase staging: 시퀀스 동안 prev view 유지하다가 단계별로 incoming view 적용
  const {
    displayView,
    peakingHandCardId: multiPeekingId,
    flippingCardId: multiFlippingId,
    flippingPhase: multiFlippingPhase,
    currentPhase: animationPhase,
    awaitingStep,
    continueStep,
  } = useMultiTurnSequence(inputView, { stepMode });
  // 시퀀스 완료(phase='idle') 시점에 specials EventOverlay 발화 — 손패 비행 끝난 후
  useMultiSpecialsTrigger(displayView, animationPhase);

  const effectiveView = displayView;
  const myPlayer = effectiveView.players.find((p) => p.userId === effectiveView.myUserId);
  const isMyTurn = effectiveView.turnUserId === effectiveView.myUserId;

  const effectiveFlippingId = flippingCardId ?? multiFlippingId;
  const effectivePeakingId = peakingFromProps ?? localPeakingId ?? multiPeekingId;

  // 9월 열끗(국준) 획득 시 끗/쌍피 선택 모달 (rules-final.md §1-5)
  // raw broadcast view 전달 — phase별 displayView 변화 race 방지 (상대 turn 시 잘못 trigger 차단)
  const myPlayerRaw = view.players.find((p) => p.userId === view.myUserId);
  const nineYeol = useNineYeolDecision(view, myPlayerRaw);
  const my9YeolAsSsangPi = myPlayer?.flags?.nineYeolAsSsangPi ?? false;

  // 쇼당 선언 — 3인+ 모드, 본인 턴에만 활성화 (친구간 협의 룰)
  const canDeclareShodang = isMyTurn && effectiveView.players.length >= 3;
  async function declareShodang() {
    if (!confirm('쇼당을 선언하시겠습니까?\n\n이 판이 즉시 무효(나가리)로 종료되고, 다음 판 점수가 ×2로 누적됩니다.')) return;
    const r = await emitWithAck('game:declare-shodang');
    if (!r.ok) toast.error(r.error);
  }

  const matchableIds = useMemo(() => {
    if (!myPlayer?.hand || !isMyTurn) return new Set<string>();
    return new Set(getMatchableCardsFromHand(myPlayer.hand, effectiveView.field).map((c) => c.id));
  }, [myPlayer?.hand, effectiveView.field, isMyTurn]);

  // 테스트 모드 트리거 카드 — preset 명시된 myHand 카드들이 손패에 있으면 강조
  const triggerIds = useMemo(() => {
    if (!effectiveView.testMode || !effectiveView.testPreset) return undefined;
    const setup = PRESETS[effectiveView.testPreset];
    if (!setup?.myHand) return undefined;
    return new Set(setup.myHand);
  }, [effectiveView.testMode, effectiveView.testPreset]);

  // 턴 시간 카운트다운 — server가 turn timer 관리 (자동 발동 포함).
  // 클라는 broadcast의 turnStartedAt + currentTurnLimitSec으로 모든 player turn 카운트 표시.
  // 1인 AI 모드는 server에서 timer skip (turnStartedAt undefined) → 카운트 X.
  const remainingSec = useAnyTurnCountdown(effectiveView);
  const isCountdownForMe = isMyTurn && remainingSec !== null;
  // 자동 발동 2회+ player에게만 5초 단축 표시 (server가 currentTurnLimitSec 5로 broadcast)
  const isShortened =
    remainingSec !== null && (effectiveView.currentTurnLimitSec ?? 0) <= 5;

  // 게임 도중 어떤 player든 흔들기/폭탄 적용 시 EventOverlay 발화 (shookMonths/bombs 변화 감지).
  // 게임 시작 시 모달은 rules-final.md §4 개정으로 제거됨 — pending=false 항상.
  useShakeBombFireTrigger(displayView, false);
  // 총통 발동 시 EventOverlay 발화 (모든 player 동시)
  useChongtongFireTrigger(displayView);

  function handlePlayCardWithPeek(cardId: string) {
    // rules-final.md §4 — 흔들기 게임 도중 발동.
    // 같은 month 3장 보유 + 그 월 흔들기 미선언 + 본인 turn → 흔들기 모달.
    const card = myPlayer?.hand?.find((c) => c.id === cardId);
    // 폭탄/조커 카드는 흔들기 모달 발동 X (createBombCard month=1이라 1월 카드와 충돌 방지)
    if (card && !card.isBomb && !card.isJoker && isMyTurn) {
      const sameMonthCards = (myPlayer?.hand ?? []).filter(
        (c) => !c.isBomb && !c.isJoker && c.month === card.month,
      );
      const shookMonths = (myPlayer?.flags?.shookMonths ?? []) as number[];
      const monthAlreadyShook = shookMonths.includes(card.month);
      if (sameMonthCards.length === 3 && !monthAlreadyShook) {
        // 흔들기 모달 — onShakeAccept / onShakeDecline에서 후속 처리
        setPendingShake({ cardId, month: card.month, cards: sameMonthCards });
        return;
      }
    }

    // 일반 흐름
    doPlayCardEmit(cardId, false);
  }

  /** localPeakingId 즉시 set + server emit + fallback timeout 1s. */
  function doPlayCardEmit(cardId: string, declineBomb: boolean) {
    setLocalPeakingId(cardId);
    if (peakingTimerRef.current) clearTimeout(peakingTimerRef.current);
    void emitPlayCardMulti(cardId, undefined, undefined, declineBomb);
    peakingTimerRef.current = setTimeout(() => {
      setLocalPeakingId(null);
    }, 1000);
  }

  /** 흔들기 모달 [O] — server에 선언 + 바닥 매칭 검사 → 폭탄 모달 또는 1장 내기 */
  async function onShakeAccept() {
    if (!pendingShake) return;
    const { cardId, month } = pendingShake;
    setPendingShake(null);
    const r = await emitWithAck('game:declare-shake', { month });
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    // 흔들기 선언 후 바닥에 같은 month 카드 있으면 폭탄 모달
    const fieldCard = effectiveView.field.find((c) => c.month === month);
    const handCards = (myPlayer?.hand ?? []).filter((c) => c.month === month);
    if (fieldCard) {
      setPendingBomb({ cardId, month, handCards, fieldCard });
      return;
    }
    // 바닥 매칭 X — 일반 1장 내기 (흔들기 ×2만)
    doPlayCardEmit(cardId, false);
  }

  /** 흔들기 모달 [X] — 일반 매칭 (×2 X). 폭탄 자동 발동도 안 됨. */
  function onShakeDecline() {
    if (!pendingShake) return;
    const { cardId } = pendingShake;
    setPendingShake(null);
    doPlayCardEmit(cardId, false);
  }

  /** 폭탄 모달 [폭탄] — server에서 isBomb 자동 발동 (declineBomb=false) */
  function onBombAccept() {
    if (!pendingBomb) return;
    const { cardId } = pendingBomb;
    setPendingBomb(null);
    doPlayCardEmit(cardId, false);
  }

  /** 폭탄 모달 [1장] — declineBomb=true로 server에 전달. 일반 매칭. */
  function onBombSingle() {
    if (!pendingBomb) return;
    const { cardId } = pendingBomb;
    setPendingBomb(null);
    doPlayCardEmit(cardId, true);
  }

  /** 흔들기/폭탄 모달 [취소] — emit X, 모달만 닫음. 손패는 그대로. */
  function onShakeCancel() {
    setPendingShake(null);
  }
  function onBombCancel() {
    setPendingBomb(null);
  }

  // broadcast 도착으로 Phase 1-A peak 시작되면 localPeakingId clear — peak 효과는
  // multiPeekingId에서 이어받음. 사용자 시각에는 클릭 즉시 확대 → 비행까지 한 번만 확대.
  useEffect(() => {
    if (multiPeekingId !== null && localPeakingId !== null) {
      setLocalPeakingId(null);
      if (peakingTimerRef.current) clearTimeout(peakingTimerRef.current);
    }
  }, [multiPeekingId, localPeakingId]);

  // Step 모드 OFF 토글 시 진행 중 모달 즉시 해제 — 사용자 click 대기 promise resolve.
  useEffect(() => {
    if (!stepMode && awaitingStep) {
      continueStep();
    }
  }, [stepMode, awaitingStep, continueStep]);

  const others = effectiveView.players.filter((p) => p.userId !== effectiveView.myUserId);

  // 대기실 호스트 컨트롤 — phase='waiting' + 호스트일 때만 OpponentSlot 클릭 메뉴 활성화.
  // 게임 진행 중에는 undefined로 전달해 메뉴 비활성화 (slot도 클릭 안 됨).
  const isWaitingHost = isHost && view.phase === 'waiting';
  const gwangPaliActive = view.players.length > 3;
  const gwangPaliAssignments = view.gwangPaliAssignments ?? [];
  function buildOpponentMenu(targetUserId: string): OpponentMenuActions | undefined {
    if (!isWaitingHost) return undefined;
    return {
      onAssignSpectator: async () => {
        const r = await emitWithAck('room:toggle-spectator', { targetUserId });
        if (!r.ok) toast.error(r.error);
      },
      onAssignGwangPali: gwangPaliActive
        ? async () => {
            const isAssigned = gwangPaliAssignments.includes(targetUserId);
            const r = await emitWithAck('room:assign-gwangpali', {
              targetUserId,
              assigned: !isAssigned,
            });
            if (!r.ok) toast.error(r.error);
          }
        : undefined,
      isGwangPaliAssigned: gwangPaliAssignments.includes(targetUserId),
      onTransferHost: async () => {
        const target = effectiveView.players.find((p) => p.userId === targetUserId);
        const nick = target?.nickname ?? '해당 사용자';
        if (!confirm(`방장 권한을 ${nick}님에게 위임하시겠어요?`)) return;
        const r = await emitWithAck('room:transfer-host', { targetUserId });
        if (!r.ok) toast.error(r.error);
      },
      onKick: async () => {
        const target = effectiveView.players.find((p) => p.userId === targetUserId);
        const nick = target?.nickname ?? '해당 사용자';
        if (!confirm(`정말 ${nick}님을 강퇴하시겠어요?`)) return;
        const r = await emitWithAck('room:kick', { targetUserId });
        if (!r.ok) toast.error(r.error);
      },
    };
  }

  // Grid layout
  // PC: [점수판 | 게임판 | (사이드바)] / 손패는 col-span 점수판+게임판 (사이드바 제외)
  // 모바일: [점수판 | 게임판/손패]. 화상은 풀스크린 모달.
  const collectedW = isCompact ? COLLECTED_PANEL_WIDTH.mobile : COLLECTED_PANEL_WIDTH.pc;
  const showVideoSidebar = !isCompact && videoSidebar != null;
  const gridCols = isCompact
    ? `${collectedW}px 1fr`
    : showVideoSidebar
      ? `${collectedW}px 1fr auto`
      : `${collectedW}px 1fr`;
  const gridRows = `auto minmax(0, 1fr) ${handMin}px`;
  const gap = isCompact ? '2px' : '8px';

  // 손패 grid 위치 — 모바일: col 2, PC: 점수판~사이드바 전체 (col 1~3)
  const handGridPlacement: React.CSSProperties = isCompact
    ? { gridColumn: '2 / span 1', gridRow: '3' }
    : {
        gridColumn: showVideoSidebar ? '1 / span 3' : '1 / span 2',
        gridRow: '3',
      };
  // 헤더 grid 위치 — PC에서 사이드바 있으면 col 1~3 전체
  const headerGridPlacement: React.CSSProperties = isCompact
    ? { gridColumn: '1 / span 2', gridRow: '1' }
    : {
        gridColumn: showVideoSidebar ? '1 / span 3' : '1 / span 2',
        gridRow: '1',
      };

  const handSection = myPlayer ? (
    <section
      className={`flex flex-shrink-0 rounded-lg border ${isCompact ? 'p-0.5' : 'p-2'} ${
        isMyTurn
          ? 'border-amber-400/60 bg-amber-400/10 sm:shadow-[0_0_16px_rgba(251,191,36,0.25)]'
          : 'border-felt-900/60 bg-felt-900/40'
      }`}
      style={{ maxHeight: handMax, ...handGridPlacement }}
    >
      <MyHand
        hand={myPlayer.hand ?? []}
        matchableIds={matchableIds}
        isMyTurn={isMyTurn}
        onPlayCard={handlePlayCardWithPeek}
        compact={isCompact}
        peakingCardId={effectivePeakingId ?? null}
        triggerIds={triggerIds}
      />
    </section>
  ) : (
    <section
      className="rounded border border-felt-900/60 bg-felt-900/40 py-2 text-center text-xs text-felt-300"
      style={handGridPlacement}
    >
      관전 중
    </section>
  );

  return (
    <AnimationPhaseContext.Provider value={animationPhase}>
    <LayoutGroup>
      <div
        ref={rootRef}
        className="bg-felt grid h-full w-full text-felt-50"
        style={{
          gridTemplateColumns: gridCols,
          gridTemplateRows: gridRows,
          gap,
          padding: gap,
        }}
      >
        {badge && !isCompact && (
          <div className="absolute left-1/2 top-1 z-50 -translate-x-1/2 rounded-full border border-amber-400/50 bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-200 backdrop-blur-sm">
            {badge}
          </div>
        )}

        {/* 턴 시간 제한 카운트다운 — server가 timer 관리, 클라는 표시.
            본인 turn이면 상단 가운데. 상대 turn이면 OpponentSlot에서 표시 (props 전달). */}
        {isCountdownForMe && (
          <div
            className={`pointer-events-none absolute left-1/2 top-1 z-40 -translate-x-1/2 rounded-full border px-3 py-1 text-xs font-bold backdrop-blur-sm ${
              remainingSec! <= 5
                ? 'border-rose-400/60 bg-rose-500/30 text-rose-200 animate-pulse'
                : 'border-felt-700/60 bg-felt-950/80 text-felt-200'
            }`}
          >
            ⏱ {remainingSec}초{isShortened && remainingSec! > 5 ? '' : ''}
          </div>
        )}

        {/* 테스트 모드 한정 — 상단 중앙 토글 버튼 (5개 컨트롤 hide/show. 추후 제거) */}
        {view.testMode && (
          <button
            onClick={() => setTestControlsVisible((v) => !v)}
            className="absolute left-1/2 top-2 z-50 -translate-x-1/2 rounded-full border border-rose-500/60 bg-rose-950/90 px-2 py-0.5 text-[12px] font-bold text-rose-100 hover:bg-rose-900/90"
            title="시나리오 컨트롤 + 로비/설정 5개 토글"
          >
            {testControlsVisible ? '🙈 숨기기' : '🎛️ 컨트롤'}
          </button>
        )}

        {/* 테스트 모드 활성 시 — 명시적 배너 + 호스트면 시나리오 변경/재시작 컨트롤 */}
        {view.testMode && testControlsVisible && (
          <div className="absolute left-2 top-2 z-40 flex items-center gap-2">
            <span className="pointer-events-none rounded border border-rose-500/60 bg-rose-500/20 px-2 py-0.5 text-[15px] font-bold text-rose-100 backdrop-blur-sm">
              🧪 시나리오: {view.testPreset ? PRESET_LABELS[view.testPreset] : '없음'}
            </span>
            {isHost && (
              <>
                <select
                  value={view.testPreset ?? 'default'}
                  onChange={async (e) => {
                    const r = await emitWithAck('game:set-test-preset', {
                      preset: e.target.value as PresetId,
                    });
                    if (!r.ok) toast.error(r.error);
                  }}
                  className="max-w-[300px] truncate rounded border border-rose-500/60 bg-rose-950/80 px-2 py-0.5 text-[15px] font-bold text-rose-100 hover:border-rose-400"
                  title="다른 시나리오 선택 — 즉시 재시작"
                >
                  {(Object.keys(PRESET_LABELS) as PresetId[]).map((id) => (
                    <option key={id} value={id}>
                      {PRESET_LABELS[id]}
                    </option>
                  ))}
                </select>
                <button
                  onClick={async () => {
                    const r = await emitWithAck('game:test-restart');
                    if (!r.ok) toast.error(r.error);
                  }}
                  className="rounded border border-rose-500/60 bg-rose-500/30 px-2 py-0.5 text-[15px] font-bold text-rose-100 hover:bg-rose-500/50"
                  title="같은 시나리오로 즉시 다시 시작"
                >
                  🔁 같은 시나리오 다시
                </button>
                <TestSpeedSelect />
                <button
                  onClick={() => setStepModeEnabled((v) => !v)}
                  className={`rounded border px-2 py-0.5 text-[15px] font-bold ${
                    stepModeEnabled
                      ? 'border-amber-400/60 bg-amber-500/30 text-amber-100 hover:bg-amber-500/50'
                      : 'border-felt-700/60 bg-felt-950/80 text-felt-200 hover:border-felt-500'
                  }`}
                  title="Step 모드 — ON이면 phase마다 click 대기, OFF면 자동 진행"
                >
                  {stepModeEnabled ? '⏸ Step ON' : '▶ Step OFF'}
                </button>
              </>
            )}
          </div>
        )}

        {/* 헤더 — PC에서 사이드바 있으면 col 1~3 전체 */}
        <div className="min-w-0" style={headerGridPlacement}>
          {isCompact ? (
            <CompactHeader
              view={effectiveView}
              myPlayer={myPlayer}
              isMyTurn={isMyTurn}
              onLeave={onLeave}
              onOpenSettings={() => setSettingsOpen(true)}
              afkUserId={afkUserId}
              remainingSec={remainingSec}
            />
          ) : (
            <section
              className={`grid gap-2 ${
                others.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
              }`}
            >
              {others.map((p) => {
                const isThisTurn = effectiveView.turnUserId === p.userId;
                return (
                  <OpponentSlot
                    key={p.userId}
                    player={p}
                    isCurrentTurn={isThisTurn}
                    allowGukJoon={view.rules?.allowGukJoon ?? true}
                    isAfk={afkUserId === p.userId}
                    remainingSec={isThisTurn ? remainingSec : null}
                    menuActions={buildOpponentMenu(p.userId)}
                  />
                );
              })}
            </section>
          )}
        </div>

        {/* 좌측 점수판 — col 1, row 2 (모바일은 row-span-2: game+hand 영역) */}
        <div
          className="min-h-0 overflow-hidden rounded-lg border border-felt-900/50 bg-felt-900/30"
          style={{
            gridColumn: '1',
            gridRow: isCompact ? '2 / span 2' : '2',
          }}
        >
          <MobileCollected
            collected={myPlayer?.collected ?? []}
            isCompact={isCompact}
            playerCount={effectiveView.players.length}
            winScoreOverride={view.rules?.winScore}
            nineYeolAsSsangPi={my9YeolAsSsangPi}
            allowGukJoon={view.rules?.allowGukJoon ?? true}
          />
        </div>

        {/* 가운데 — 게임판. col 2 row 2 */}
        <div
          className="relative z-10 min-h-0 overflow-visible"
          style={{ gridColumn: '2', gridRow: '2' }}
        >
          <CenterField
            field={effectiveView.field}
            deckCount={effectiveView.deckCount}
            flippingCardId={effectiveFlippingId ?? null}
            flippingPhase={multiFlippingPhase}
            isCompact={isCompact}
          />
          {/* 본인 누적 배수 + 고 횟수 — 게임판 좌측 하단 (사이드바 총점수와 같은 높이) */}
          {(() => {
            const m = computeMultiplier(myPlayer);
            const goN = myPlayer?.goCount ?? 0;
            if (m <= 1 && goN === 0) return null;
            return (
              <div className="pointer-events-none absolute bottom-2 left-2 flex items-end gap-2">
                {goN > 0 && (
                  <span
                    className={`rounded-full bg-rose-500/80 px-2 py-0.5 font-black text-white shadow-[0_0_8px_rgba(244,63,94,0.6)] ${
                      isCompact ? 'text-base' : 'text-2xl'
                    }`}
                  >
                    {goN}고
                  </span>
                )}
                {m > 1 && (
                  <span
                    title={multiplierBreakdown(myPlayer)}
                    className={`font-black text-amber-300 drop-shadow-[0_0_8px_rgba(252,211,77,0.7)] ${
                      isCompact ? 'text-3xl' : 'text-5xl'
                    }`}
                  >
                    ×{m}
                  </span>
                )}
              </div>
            );
          })()}
        </div>

        {/* PC 우측 화상 사이드바 — col 3 row 2만 (게임판 영역, 점수판과 같은 행) */}
        {showVideoSidebar && (
          <div
            className="min-h-0"
            style={{ gridColumn: '3', gridRow: '2' }}
          >
            {videoSidebar}
          </div>
        )}

        {/* 하단 손패 — 모바일: col 2만, PC: col-span-2 (점수판+게임판) */}
        {handSection}

        {/* PC 우측 상단 — 로비/설정 버튼 fixed. testMode면 토글로 숨김 가능 */}
        {!isCompact && (!view.testMode || testControlsVisible) && (
          <div className="pointer-events-auto fixed right-3 top-3 z-30 flex gap-1.5">
            <button
              onClick={() => void onLeave()}
              className="flex h-9 items-center gap-1 rounded-full border border-rose-600/50 bg-rose-900/60 px-3 text-xs font-bold text-rose-100 shadow-lg backdrop-blur-sm transition hover:scale-105 hover:bg-rose-800/70 active:scale-95"
              aria-label="로비로 나가기"
              title="로비로 나가기"
            >
              🚪 로비로
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-felt-700/60 bg-felt-950/90 text-lg shadow-lg backdrop-blur-sm transition hover:scale-110 hover:bg-felt-900 active:scale-95"
              aria-label="설정"
              title="설정"
            >
              ⚙️
            </button>
          </div>
        )}

        {/* 모바일 화상 토글 버튼 — 우측 (이모지 버튼 위쪽) */}
        {isCompact && videoMobileModalRender && (
          <button
            onClick={() => setVideoModalOpen(true)}
            className="pointer-events-auto fixed right-3 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-felt-700/60 bg-felt-950/90 text-xl shadow-lg backdrop-blur-sm transition hover:scale-110 hover:bg-felt-900 active:scale-95"
            style={{ top: 'calc(50% - 56px)' }}
            aria-label={view.rules?.mediaMode === 'voice-only' ? '음성채팅' : '화상채팅'}
            title={view.rules?.mediaMode === 'voice-only' ? '음성채팅' : '화상채팅'}
          >
            {view.rules?.mediaMode === 'voice-only' ? '🎙️' : '🎥'}
          </button>
        )}

        {/* 이모지 반응 — socket broadcast */}
        <EmojiReactions />

        {/* 채팅 토글 버튼 — 우측 (이모지 버튼 아래) */}
        <button
          onClick={() => setChatOpen(true)}
          className="pointer-events-auto fixed right-3 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-felt-700/60 bg-felt-950/90 text-xl shadow-lg backdrop-blur-sm transition hover:scale-110 hover:bg-felt-900 active:scale-95"
          style={{ top: 'calc(50% + 56px)' }}
          aria-label="채팅"
          title="채팅"
        >
          💬
          {chatUnread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
              {chatUnread > 9 ? '9+' : chatUnread}
            </span>
          )}
        </button>

        {/* 설정 모달 */}
        <SettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          mediaSettings={mediaSettings}
          playerSection={
            <PlayerActions
              canDeclareShodang={canDeclareShodang}
              onDeclareShodang={() => {
                setSettingsOpen(false);
                void declareShodang();
              }}
            />
          }
          hostSection={
            isHost ? (
              <HostRulesAction
                onOpenRules={() => {
                  setSettingsOpen(false);
                  setRulesOpen(true);
                }}
              />
            ) : undefined
          }
        />

        {/* 방 룰 모달 — 게임 중(playing)에는 변경 차단 */}
        <RoomRulesModal
          open={rulesOpen}
          current={view.rules}
          canEdit={isHost}
          inGame={view.phase === 'playing'}
          onClose={() => setRulesOpen(false)}
        />

        {/* 채팅 모달 */}
        <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />

        {/* 매칭 카드 종류 다른 2장일 때 사용자 선택 모달 (rules-final.md §1-6).
            Phase 1~3 진행 완료 (animationPhase==='idle') + 본인 turn 시 발화.
            상대 turn에 phase별 stale view로 잘못 표시되는 케이스 차단. */}
        <TargetPickerModal
          open={pendingMultiPick !== null && animationPhase === 'idle' && isMyTurn}
          handCard={pendingMultiPick?.handCard ?? null}
          candidates={pendingMultiPick?.candidates ?? []}
          onPick={handleMultiPick}
          onCancel={cancelMultiPick}
        />

        {/* 게임 도중 흔들기 선언 모달 (rules-final.md §4-1) — 카드 클릭 시 발동 */}
        <ShakeDecisionModal
          open={pendingShake !== null}
          month={pendingShake?.month ?? 0}
          cards={pendingShake?.cards ?? []}
          onShake={() => void onShakeAccept()}
          onDecline={onShakeDecline}
          onCancel={onShakeCancel}
        />

        {/* 폭탄 발동 선택 모달 (rules-final.md §4-2 ①/②) — 흔들기 O + 바닥 매칭 후 */}
        <BombChoiceModal
          open={pendingBomb !== null}
          month={pendingBomb?.month ?? 0}
          handCards={pendingBomb?.handCards ?? []}
          fieldCard={pendingBomb?.fieldCard}
          onBomb={onBombAccept}
          onSingle={onBombSingle}
          onCancel={onBombCancel}
        />

        {/* winScore 도달 시 go/stop 선택 모달 (rules-final.md §5).
            server pendingGoStop 본인일 때만 노출. animation phase 완료 후 발화. */}
        <GoStopModal
          open={
            view.pendingGoStop?.playerId === view.myUserId &&
            animationPhase === 'idle'
          }
          score={view.pendingGoStop?.score ?? 0}
          goCount={myPlayerRaw?.goCount ?? 0}
          onGo={async () => {
            const r = await emitWithAck('game:action', { type: 'declare-go' });
            if (!r.ok && 'error' in r) toast.error(r.error);
          }}
          onStop={async () => {
            const r = await emitWithAck('game:action', { type: 'declare-stop' });
            if (!r.ok && 'error' in r) toast.error(r.error);
          }}
        />

        {/* 9월 열끗(국준) 획득 시 끗/쌍피 선택 모달 (rules-final.md §1-5).
            Phase 3 완료 후 + 다른 모달이 닫힌 후에만 발화 */}
        <NineYeolPickerModal
          open={
            nineYeol.open &&
            animationPhase === 'idle' &&
            pendingMultiPick === null
          }
          onPick={nineYeol.pick}
        />

        {/* 모바일 화상 풀스크린 모달 — render prop으로 LiveKit context 안 컴포넌트 호출 */}
        {videoMobileModalRender?.({
          open: videoModalOpen,
          onClose: () => setVideoModalOpen(false),
        })}

        {/* step 모드 — 각 sub-phase 사이 사용자 click 대기 모달 (testMode + 호스트만) */}
        {stepMode && awaitingStep && (
          <StepDebugModal label={awaitingStep} onContinue={continueStep} />
        )}
      </div>
    </LayoutGroup>
    </AnimationPhaseContext.Provider>
  );
}

/**
 * step 모드 디버그 모달 — 각 sub-phase 끝에서 사용자 click 대기.
 *
 * 화면 중앙 하단 고정 + Space 키 단축키로도 진행 가능. testMode + 호스트일 때만 노출.
 */
function StepDebugModal({
  label,
  onContinue,
}: {
  label: string;
  onContinue: () => void;
}) {
  // Space 키 단축키
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === 'Space') {
        e.preventDefault();
        onContinue();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onContinue]);

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <div className="pointer-events-auto flex items-center gap-3 rounded-lg border border-amber-400/60 bg-felt-950/95 px-4 py-2 shadow-xl backdrop-blur-sm">
        <span className="text-sm font-bold text-amber-200">{label}</span>
        <button
          onClick={onContinue}
          className="rounded border border-amber-400/60 bg-amber-500/30 px-3 py-1 text-sm font-bold text-amber-100 hover:bg-amber-500/50 active:scale-95"
          title="Space 키로도 진행 가능"
        >
          다음 ▶ (Space)
        </button>
      </div>
    </div>
  );
}

/**
 * 테스트 모드 한정 — 애니메이션 배속 select.
 * RoomLobbyModal에 있는 컨트롤을 GameView에도 노출해 게임 중 배속 조정 가능.
 */
function TestSpeedSelect() {
  const speed = useDevTestStore((s) => s.animationSpeed);
  const setSpeed = useDevTestStore((s) => s.setAnimationSpeed);
  return (
    <select
      value={speed}
      onChange={(e) => setSpeed(Number(e.target.value) as typeof speed)}
      className="rounded border border-rose-500/60 bg-rose-950/80 px-2 py-0.5 text-[15px] font-bold text-rose-100 hover:border-rose-400"
      title="애니메이션 배속 — 모든 sec() 적용 duration에 영향"
    >
      {ANIMATION_SPEED_OPTIONS.map((s) => (
        <option key={s} value={s}>
          {s}× 배속
        </option>
      ))}
    </select>
  );
}
