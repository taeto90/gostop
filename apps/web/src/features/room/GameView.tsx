import { LayoutGroup } from 'framer-motion';
import { AnimationPhaseContext } from '../../lib/animationContext.ts';
import { useMemo, useRef, useState } from 'react';
import { useAfkDetect } from '../../hooks/useAfkDetect.ts';
import { useAnyTurnCountdown } from '../../hooks/useAnyTurnCountdown.ts';
import { useMultiPlayCard } from '../../hooks/useMultiPlayCard.ts';
import { useMultiSpecialsTrigger } from '../../hooks/useMultiSpecialsTrigger.ts';
import { useMultiTurnSequence } from '../../hooks/useMultiTurnSequence.ts';
import { toast } from '../../stores/toastStore.ts';
import type { Card, RoomView } from '@gostop/shared';
import { getMatchableCardsFromHand } from '@gostop/shared';
import { TargetPickerModal } from './game-ui/TargetPickerModal.tsx';
import { useElementSize } from '../../hooks/useElementSize.ts';
import { ChatPanel } from '../../components/ChatPanel.tsx';
import { EmojiReactions } from '../../components/EmojiReactions.tsx';
import { SettingsModal } from '../../components/SettingsModal.tsx';
import { emitWithAck } from '../../lib/socket.ts';
import { useChatStore } from '../../stores/chatStore.ts';
import {
  COLLECTED_PANEL_WIDTH,
  HAND_AREA_MAX,
  HAND_AREA_MIN,
  HAND_AREA_RATIO,
  isCompactWidth,
} from '../../lib/layoutConstants.ts';
import { HAND_PEAK_DURATION } from '../../lib/animationTiming.ts';
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
  const [rulesOpen, setRulesOpen] = useState(false);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const chatUnread = useChatStore((s) => s.unreadCount);
  const isHost = view.hostUserId === view.myUserId;

  // AFK 감지 — turn 시작 후 30초+ 응답 없으면 해당 userId 표시
  const afkUserId = useAfkDetect(view.turnUserId);
  // 4-phase staging: 시퀀스 동안 prev view 유지하다가 단계별로 incoming view 적용
  const {
    displayView,
    peakingHandCardId: multiPeekingId,
    flippingCardId: multiFlippingId,
    currentPhase: animationPhase,
  } = useMultiTurnSequence(view);
  // 시퀀스 완료(phase='idle') 시점에 specials EventOverlay 발화 — 손패 비행 끝난 후
  useMultiSpecialsTrigger(displayView, animationPhase);

  const effectiveView = displayView;
  const myPlayer = effectiveView.players.find((p) => p.userId === effectiveView.myUserId);
  const isMyTurn = effectiveView.turnUserId === effectiveView.myUserId;

  const effectiveFlippingId = flippingCardId ?? multiFlippingId;
  const effectivePeakingId = peakingFromProps ?? localPeakingId ?? multiPeekingId;

  // 본인이 9월 열끗(`m09-yeol`)을 collected에 보유 중이면 끗↔쌍피 변환 토글 노출
  const has9Yeol = myPlayer?.collected.some((c) => c.id === 'm09-yeol') ?? false;
  const my9YeolAsSsangPi = myPlayer?.flags?.nineYeolAsSsangPi ?? false;
  async function toggle9Yeol() {
    const r = await emitWithAck('game:toggle-9yeol', { value: !my9YeolAsSsangPi });
    if (!r.ok) toast.error(r.error);
  }

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

  // 턴 시간 카운트다운 — server가 turn timer 관리 (자동 발동 포함).
  // 클라는 broadcast의 turnStartedAt + currentTurnLimitSec으로 모든 player turn 카운트 표시.
  // 1인 AI 모드는 server에서 timer skip (turnStartedAt undefined) → 카운트 X.
  const remainingSec = useAnyTurnCountdown(effectiveView);
  const isCountdownForMe = isMyTurn && remainingSec !== null;
  // 자동 발동 2회+ player에게만 5초 단축 표시 (server가 currentTurnLimitSec 5로 broadcast)
  const isShortened =
    remainingSec !== null && (effectiveView.currentTurnLimitSec ?? 0) <= 5;
  // 멀티 모드 play-card emit + needsSelection 모달 처리 (Phase 3 후, rules-final.md §1-6)
  const {
    pendingPick: pendingMultiPick,
    emitPlayCard: emitPlayCardMulti,
    handlePick: handleMultiPick,
    cancelPick: cancelMultiPick,
  } = useMultiPlayCard(myPlayer);

  function handlePlayCardWithPeek(cardId: string) {
    // 클릭 카드 잠시 확대 후 server 액션 emit
    setLocalPeakingId(cardId);
    if (peakingTimerRef.current) clearTimeout(peakingTimerRef.current);
    peakingTimerRef.current = setTimeout(() => {
      setLocalPeakingId(null);
      void emitPlayCardMulti(cardId);
    }, HAND_PEAK_DURATION * 1000);
  }

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

        {/* 테스트 모드 활성 시 — 명시적 배너 (호스트가 wait 모달에서 토글, 게임 중 항상 표시) */}
        {view.testMode && (
          <div className="pointer-events-none absolute left-2 top-2 z-40 rounded border border-rose-500/60 bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-100 backdrop-blur-sm">
            🧪 TEST MODE
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
            isCompact={isCompact}
          />
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

        {/* PC 우측 상단 — 로비/설정 버튼 fixed */}
        {!isCompact && (
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
              has9Yeol={has9Yeol}
              my9YeolAsSsangPi={my9YeolAsSsangPi}
              onToggle9Yeol={() => void toggle9Yeol()}
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

        {/* 매칭 카드 종류 다른 2장일 때 사용자 선택 모달 (rules-final.md §1-6) */}
        <TargetPickerModal
          open={pendingMultiPick !== null}
          handCard={pendingMultiPick?.handCard ?? null}
          candidates={pendingMultiPick?.candidates ?? []}
          onPick={handleMultiPick}
          onCancel={cancelMultiPick}
        />

        {/* 모바일 화상 풀스크린 모달 — render prop으로 LiveKit context 안 컴포넌트 호출 */}
        {videoMobileModalRender?.({
          open: videoModalOpen,
          onClose: () => setVideoModalOpen(false),
        })}
      </div>
    </LayoutGroup>
    </AnimationPhaseContext.Provider>
  );
}
