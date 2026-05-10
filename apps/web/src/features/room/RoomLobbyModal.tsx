import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import type { AiDifficulty, RoomView } from '@gostop/shared';
import { useChatStore } from '../../stores/chatStore.ts';
import { useRoomStore } from '../../stores/roomStore.ts';
import { toast } from '../../stores/toastStore.ts';
import { emitWithAck } from '../../lib/socket.ts';
import { markRoomLeft } from '../../lib/leftRoomGuard.ts';
import {
  MODAL_SCALE_ANIMATE,
  MODAL_SCALE_EXIT,
  MODAL_SCALE_INITIAL,
  MODAL_SPRING,
} from '../../lib/animationTiming.ts';
import { ChatInlinePanel, ChatPanel } from '../../components/ChatPanel.tsx';
import { InviteLink } from '../../components/InviteLink.tsx';
import { useElementSize } from '../../hooks/useElementSize.ts';
import { isCompactWidth } from '../../lib/layoutConstants.ts';
import { AISetupModal } from './AISetupModal.tsx';
import { RoomRulesModal } from './RoomRulesModal.tsx';
import { LobbyMemberCard } from './LobbyMemberCard.tsx';

interface RoomLobbyModalProps {
  view: RoomView;
}

/**
 * 방 입장 후 게임 시작 전까지 보는 메인 컨트롤 모달.
 *
 * - PC (≥ 950px): 좌측 본문 + 우측 ChatInlinePanel grid
 * - 모바일: 단일 컬럼, 채팅은 헤더 버튼으로 모달 토글
 *
 * 호스트 컨트롤(관전자 지정/위임/강퇴)은 player slot 클릭 시 popover로 노출.
 * 드래그&드롭으로 player ↔ spectator 이동도 가능 (HTML5 native API).
 */
export function RoomLobbyModal({ view }: RoomLobbyModalProps) {
  const navigate = useNavigate();
  const clear = useRoomStore((s) => s.clear);
  const chatUnread = useChatStore((s) => s.unreadCount);

  const [containerRef, { width }] = useElementSize<HTMLDivElement>();
  const isCompact = isCompactWidth(width);

  const [chatOpen, setChatOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [aiSetupOpen, setAiSetupOpen] = useState(false);
  // 테스트 모드 (호스트만, 추후 제거) — 손패 1장 + 바닥 1장
  const [testMode, setTestMode] = useState(view.testMode ?? false);

  const isHost = view.hostUserId === view.myUserId;
  const canStart = view.players.length >= 1 && view.players.length <= 5;
  const gwangPaliCount = Math.max(0, view.players.length - 3);
  const volunteers = view.gwangPaliVolunteers ?? [];
  const amVolunteer = volunteers.includes(view.myUserId);
  const amPlayer = view.players.some((p) => p.userId === view.myUserId);
  const currentBots = view.players.filter((p) => p.userId.startsWith('ai-bot-'));
  const hasBotsConfigured = currentBots.length > 0;

  // ===== actions =====
  async function startGame() {
    const r = await emitWithAck('game:start', { testMode });
    if (!r.ok) toast.error(r.error);
  }

  async function leaveRoom() {
    await emitWithAck('room:leave');
    clear();
    markRoomLeft(view.roomId);
    navigate('/', { replace: true });
  }

  async function toggleVolunteer() {
    const r = await emitWithAck('room:toggle-gwangpali-volunteer');
    if (!r.ok) toast.error(r.error);
  }

  async function toggleSelfSpectator() {
    const r = await emitWithAck('room:toggle-spectator', {});
    if (!r.ok) toast.error(r.error);
  }

  async function addBots(diffs: AiDifficulty[]) {
    if (diffs.length === 0) return;
    const r = await emitWithAck('room:add-bots', { botDifficulties: diffs });
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(`AI 봇 ${diffs.length}명 추가됨`);
  }

  async function setMemberRole(targetUserId: string, role: 'player' | 'spectator') {
    const member =
      view.players.find((p) => p.userId === targetUserId) ??
      view.spectators.find((s) => s.userId === targetUserId);
    if (!member) return;
    const isPlayer = view.players.some((p) => p.userId === targetUserId);
    if (isPlayer && role === 'player') return;
    if (!isPlayer && role === 'spectator') return;
    const r = await emitWithAck('room:toggle-spectator', { targetUserId });
    if (!r.ok) toast.error(r.error);
  }

  // 호스트가 player 카드를 다른 player 카드 위에 드롭 → 순서 재배열 (drag된 카드를 target 위치로 이동)
  async function reorderPlayers(draggedId: string, targetId: string) {
    if (draggedId === targetId) return;
    const ids = view.players.map((p) => p.userId);
    const fromIdx = ids.indexOf(draggedId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const next = [...ids];
    next.splice(fromIdx, 1);
    next.splice(toIdx, 0, draggedId);
    const r = await emitWithAck('room:reorder-players', { playerIds: next });
    if (!r.ok) toast.error(r.error);
  }

  // AnimatePresence는 backdrop motion만 감싸야 함 — 같은 children 안에 key 없는
  // 일반 React 컴포넌트(ChatPanel/RoomRulesModal/AISetupModal)가 함께 있으면
  // React가 key=undefined 충돌로 'same key' 경고. sub-modals는 외부에서 자체 처리.
  return createPortal(
    <>
    <AnimatePresence>
      <motion.div
        key="lobby-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm"
      >
        <motion.div
          ref={containerRef}
          initial={MODAL_SCALE_INITIAL}
          animate={MODAL_SCALE_ANIMATE}
          exit={MODAL_SCALE_EXIT}
          transition={MODAL_SPRING}
          className={`relative flex max-h-[92vh] w-full overflow-hidden rounded-2xl border-2 border-amber-400/50 bg-felt-900 shadow-[0_0_40px_rgba(251,191,36,0.2)] ${
            isCompact ? 'max-w-2xl flex-col' : 'max-w-5xl flex-row'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 좌측: 본 컨텐츠 — 모바일에선 전체 width */}
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <Header
              roomId={view.roomId}
              memberCount={view.players.length}
              maxPlayers={view.maxPlayers}
              spectatorCount={view.spectators.length}
              chatUnread={chatUnread}
              showChatButton={isCompact}
              onOpenChat={() => setChatOpen(true)}
              onOpenRules={() => setRulesOpen(true)}
              onLeave={leaveRoom}
            />

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <InviteLink roomId={view.roomId} />

              <MemberSection
                view={view}
                isHost={isHost}
                volunteers={volunteers}
                onSetRole={setMemberRole}
                onReorderPlayers={reorderPlayers}
              />

              {(view.players.length <= 2 || hasBotsConfigured) && (
                <BotSection
                  isHost={isHost}
                  hasBots={hasBotsConfigured}
                  bots={currentBots.map((b) => b.nickname)}
                  onOpenSetup={() => setAiSetupOpen(true)}
                />
              )}

              <MediaModeBadge mode={view.rules?.mediaMode ?? 'video'} />

              {isHost && (
                <TestModeToggle checked={testMode} onChange={setTestMode} />
              )}

              {gwangPaliCount > 0 && (
                <GwangPaliSection
                  count={gwangPaliCount}
                  amVolunteer={amVolunteer}
                  onToggleVolunteer={() => void toggleVolunteer()}
                />
              )}

              {!isHost && (
                <button
                  onClick={() => void toggleSelfSpectator()}
                  className="w-full rounded-lg border border-sky-700/60 bg-sky-950/40 px-3 py-2 text-xs font-bold text-sky-200 transition hover:border-sky-400/60 hover:bg-sky-900/50"
                >
                  {amPlayer ? '👁️ 관전자로 전환' : '🎮 플레이어로 참가'}
                </button>
              )}
            </div>

            {/* 푸터 — 시작 버튼 */}
            <div className="border-t border-felt-800/60 bg-felt-950/40 px-5 py-3">
              {isHost ? (
                <motion.button
                  onClick={() => void startGame()}
                  disabled={!canStart}
                  whileHover={canStart ? { scale: 1.02 } : undefined}
                  whileTap={canStart ? { scale: 0.97 } : undefined}
                  className="w-full rounded-lg bg-amber-500 py-3 text-base font-bold text-slate-950 shadow-lg transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                >
                  {canStart ? '🎮 게임 시작' : '게임 시작 (최소 1명 필요)'}
                </motion.button>
              ) : (
                <div className="flex items-center justify-center gap-2 rounded-lg border border-felt-700/60 bg-felt-800/40 px-4 py-3 text-sm text-felt-300">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                  호스트가 시작하기를 기다리는 중...
                </div>
              )}
            </div>
          </div>

          {/* 우측: PC inline 채팅 (≥ 950px) */}
          {!isCompact && (
            <div className="flex w-80 flex-col border-l border-felt-800/60 bg-felt-950/30">
              <ChatInlinePanel className="h-full" />
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>

    {/* sub-modals — AnimatePresence 외부 (각자 자체 AnimatePresence 보유) */}
    <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />

    <RoomRulesModal
      open={rulesOpen}
      current={view.rules}
      canEdit={isHost}
      onClose={() => setRulesOpen(false)}
    />

    <AISetupModal
      open={aiSetupOpen}
      playerCount={view.players.length}
      onClose={() => setAiSetupOpen(false)}
      onConfirm={(diffs) => {
        setAiSetupOpen(false);
        void addBots(diffs);
      }}
    />
    </>,
    document.body,
  );
}

// ============================================================================
// 하위 컴포넌트
// ============================================================================

function Header({
  roomId,
  memberCount,
  maxPlayers,
  spectatorCount,
  chatUnread,
  showChatButton,
  onOpenChat,
  onOpenRules,
  onLeave,
}: {
  roomId: string;
  memberCount: number;
  maxPlayers: number;
  spectatorCount: number;
  chatUnread: number;
  showChatButton: boolean;
  onOpenChat: () => void;
  onOpenRules: () => void;
  onLeave: () => void;
}) {
  return (
    <header className="flex items-center justify-between gap-2 border-b border-felt-800/60 px-5 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎴</span>
          <span className="truncate text-base font-bold text-amber-300">
            방 {roomId}
          </span>
          <span className="text-xs text-felt-400">
            ({memberCount}/{maxPlayers}
            {spectatorCount > 0 && ` · 관전 ${spectatorCount}`})
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {showChatButton && (
          <HeaderIconButton onClick={onOpenChat} title="채팅" badge={chatUnread || undefined}>
            💬
          </HeaderIconButton>
        )}
        <HeaderIconButton onClick={onOpenRules} title="방 룰">
          ⚙️
        </HeaderIconButton>
        <button
          onClick={onLeave}
          className="rounded-md border border-rose-600/50 bg-rose-900/40 px-2.5 py-1.5 text-xs font-semibold text-rose-100 transition hover:bg-rose-800/50"
          title="방 나가기"
        >
          나가기
        </button>
      </div>
    </header>
  );
}

function HeaderIconButton({
  onClick,
  title,
  badge,
  children,
}: {
  onClick: () => void;
  title: string;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="relative flex h-8 w-8 items-center justify-center rounded-md border border-felt-700/60 bg-felt-950/60 text-base text-felt-200 transition hover:bg-felt-800"
    >
      {children}
      {badge !== undefined && badge > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  );
}

function MemberSection({
  view,
  isHost,
  volunteers,
  onSetRole,
  onReorderPlayers,
}: {
  view: RoomView;
  isHost: boolean;
  volunteers: readonly string[];
  onSetRole: (targetUserId: string, role: 'player' | 'spectator') => void;
  onReorderPlayers: (draggedId: string, targetId: string) => void;
}) {
  // 드래그된 유저 (드롭 대상에서 사용)
  const [draggingId, setDraggingId] = useState<string | null>(null);

  function onDragStart(userId: string) {
    setDraggingId(userId);
  }
  function onDragEnd() {
    setDraggingId(null);
  }
  function onDropTo(role: 'player' | 'spectator') {
    if (!draggingId) return;
    onSetRole(draggingId, role);
    setDraggingId(null);
  }
  function onDropOnPlayer(targetUserId: string) {
    if (!draggingId) return;
    // dragged가 player이면 순서 변경, spectator였으면 player로 이동
    const isDraggedPlayer = view.players.some((p) => p.userId === draggingId);
    if (isDraggedPlayer && isHost) {
      onReorderPlayers(draggingId, targetUserId);
    } else if (!isDraggedPlayer) {
      onSetRole(draggingId, 'player');
    }
    setDraggingId(null);
  }

  return (
    <>
      <PlayerGrid
        view={view}
        isHost={isHost}
        volunteers={volunteers}
        draggingId={draggingId}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDrop={() => onDropTo('player')}
        onDropOnPlayer={onDropOnPlayer}
        onSetRole={onSetRole}
      />
      <SpectatorGrid
        view={view}
        isHost={isHost}
        draggingId={draggingId}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDrop={() => onDropTo('spectator')}
        onSetRole={onSetRole}
      />
    </>
  );
}

function PlayerGrid({
  view,
  isHost,
  volunteers,
  draggingId,
  onDragStart,
  onDragEnd,
  onDrop,
  onDropOnPlayer,
  onSetRole,
}: {
  view: RoomView;
  isHost: boolean;
  volunteers: readonly string[];
  draggingId: string | null;
  onDragStart: (userId: string) => void;
  onDragEnd: () => void;
  onDrop: () => void;
  onDropOnPlayer: (targetUserId: string) => void;
  onSetRole: (targetUserId: string, role: 'player' | 'spectator') => void;
}) {
  // 드롭 가능한 영역 (spectator → player) 표시 — 자리 부족 시 false
  const canAcceptDrop =
    draggingId !== null &&
    view.spectators.some((s) => s.userId === draggingId) &&
    view.players.length < 5;

  return (
    <section>
      <div className="mb-2 flex items-baseline gap-2 text-xs">
        <span className="font-bold text-felt-200">플레이어</span>
        <span className="text-felt-400">
          {view.players.length}/{view.maxPlayers}
        </span>
      </div>
      <div
        className={`grid grid-cols-2 gap-2 rounded-lg p-1 transition sm:grid-cols-3 ${
          canAcceptDrop ? 'border border-dashed border-emerald-400/60 bg-emerald-500/5' : ''
        }`}
        onDragOver={canAcceptDrop ? (e) => e.preventDefault() : undefined}
        onDrop={canAcceptDrop ? onDrop : undefined}
      >
        {view.players.map((p) => {
          // drop target — 호스트가 player를 드래그 중이거나, spectator가 player로 이동 중이면 허용
          const draggedIsPlayer =
            draggingId !== null && view.players.some((pp) => pp.userId === draggingId);
          const draggedIsSpec =
            draggingId !== null && view.spectators.some((s) => s.userId === draggingId);
          const acceptDrop =
            draggingId !== null &&
            draggingId !== p.userId &&
            ((draggedIsPlayer && isHost) || (draggedIsSpec && view.players.length < 5));
          return (
            <LobbyMemberCard
              key={p.userId}
              userId={p.userId}
              emoji={p.emojiAvatar}
              nickname={p.nickname}
              isHost={p.userId === view.hostUserId}
              isMe={p.userId === view.myUserId}
              isSpectator={false}
              isVolunteer={volunteers.includes(p.userId)}
              isGwangPaliAssigned={(view.gwangPaliAssignments ?? []).includes(p.userId)}
              draggable={
                p.userId !== view.hostUserId &&
                (p.userId === view.myUserId || isHost)
              }
              onDragStart={() => onDragStart(p.userId)}
              onDragEnd={onDragEnd}
              onDropTarget={acceptDrop ? () => onDropOnPlayer(p.userId) : undefined}
              menuActions={
                isHost && p.userId !== view.myUserId
                  ? buildMenuActions(p.userId, view, onSetRole)
                  : p.userId === view.myUserId
                    ? buildSelfMenu(view.hostUserId === view.myUserId)
                    : undefined
              }
            />
          );
        })}
        {Array.from({
          length: Math.max(0, view.maxPlayers - view.players.length),
        }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="rounded-lg border border-dashed border-felt-700/60 p-2 text-center text-[11px] text-felt-500"
          >
            빈 자리
          </div>
        ))}
      </div>
    </section>
  );
}

function SpectatorGrid({
  view,
  isHost,
  draggingId,
  onDragStart,
  onDragEnd,
  onDrop,
  onSetRole,
}: {
  view: RoomView;
  isHost: boolean;
  draggingId: string | null;
  onDragStart: (userId: string) => void;
  onDragEnd: () => void;
  onDrop: () => void;
  onSetRole: (targetUserId: string, role: 'player' | 'spectator') => void;
}) {
  // player → spectator로 드롭 가능. 호스트 본인은 X
  const canAcceptDrop =
    draggingId !== null &&
    view.players.some((p) => p.userId === draggingId) &&
    draggingId !== view.hostUserId;

  return (
    <section>
      <div className="mb-2 flex items-baseline gap-2 text-xs">
        <span className="font-bold text-felt-200">관전자</span>
        <span className="text-felt-400">{view.spectators.length}</span>
      </div>
      <div
        className={`min-h-[60px] rounded-lg p-1 transition ${
          canAcceptDrop
            ? 'border border-dashed border-sky-400/60 bg-sky-500/5'
            : view.spectators.length === 0
              ? 'border border-dashed border-felt-800/60'
              : ''
        }`}
        onDragOver={canAcceptDrop ? (e) => e.preventDefault() : undefined}
        onDrop={canAcceptDrop ? onDrop : undefined}
      >
        {view.spectators.length === 0 ? (
          <div className="py-2 text-center text-[11px] text-felt-500">
            (관전자 없음 — 여기로 드래그하면 관전자로 이동)
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {view.spectators.map((s) => (
              <LobbyMemberCard
                key={s.userId}
                userId={s.userId}
                emoji={s.emojiAvatar}
                nickname={s.nickname}
                isHost={false}
                isMe={s.userId === view.myUserId}
                isSpectator
                draggable={s.userId === view.myUserId || isHost}
                onDragStart={() => onDragStart(s.userId)}
                onDragEnd={onDragEnd}
                menuActions={
                  isHost && s.userId !== view.myUserId
                    ? buildSpectatorMenuActions(s.userId, view, onSetRole)
                    : s.userId === view.myUserId
                      ? buildSelfSpectatorMenu()
                      : undefined
                }
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ============================================================================
// 메뉴 액션 빌더 — 클릭 popover 내용
// ============================================================================

function buildMenuActions(
  targetUserId: string,
  view: RoomView,
  onSetRole: (id: string, role: 'player' | 'spectator') => void,
): import('./LobbyMemberCard.tsx').LobbyMemberMenuActions {
  // 광팔이 지정 가능 조건: player 4~5명 — 메뉴는 그 때만 노출
  const gwangPaliCount = Math.max(0, view.players.length - 3);
  const assignments = view.gwangPaliAssignments ?? [];
  const canAssignGwangPali = gwangPaliCount > 0;
  const isAssigned = assignments.includes(targetUserId);

  return {
    onAssignSpectator: () => onSetRole(targetUserId, 'spectator'),
    onToggleGwangPali: canAssignGwangPali
      ? {
          assigned: isAssigned,
          toggle: async () => {
            const r = await emitWithAck('room:assign-gwangpali', {
              targetUserId,
              assigned: !isAssigned,
            });
            if (!r.ok) toast.error(r.error);
          },
        }
      : undefined,
    onTransferHost: async () => {
      const target = view.players.find((p) => p.userId === targetUserId);
      const nick = target?.nickname ?? '해당 사용자';
      if (!confirm(`방장 권한을 ${nick}님에게 위임하시겠어요?`)) return;
      const r = await emitWithAck('room:transfer-host', { targetUserId });
      if (!r.ok) toast.error(r.error);
    },
    onKick: async () => {
      const target = view.players.find((p) => p.userId === targetUserId);
      const nick = target?.nickname ?? '해당 사용자';
      if (!confirm(`정말 ${nick}님을 강퇴하시겠어요?`)) return;
      const r = await emitWithAck('room:kick', { targetUserId });
      if (!r.ok) toast.error(r.error);
    },
  };
}

function buildSpectatorMenuActions(
  targetUserId: string,
  view: RoomView,
  onSetRole: (id: string, role: 'player' | 'spectator') => void,
) {
  return {
    onAssignPlayer: () => onSetRole(targetUserId, 'player'),
    onKick: async () => {
      const target = view.spectators.find((s) => s.userId === targetUserId);
      const nick = target?.nickname ?? '해당 사용자';
      if (!confirm(`정말 ${nick}님을 강퇴하시겠어요?`)) return;
      const r = await emitWithAck('room:kick', { targetUserId });
      if (!r.ok) toast.error(r.error);
    },
  };
}

function buildSelfMenu(_isHost: boolean) {
  // 비호스트 본인 — 관전자 전환만
  if (_isHost) return undefined;
  return {
    onAssignSpectator: async () => {
      const r = await emitWithAck('room:toggle-spectator', {});
      if (!r.ok) toast.error(r.error);
    },
  };
}

function buildSelfSpectatorMenu() {
  return {
    onAssignPlayer: async () => {
      const r = await emitWithAck('room:toggle-spectator', {});
      if (!r.ok) toast.error(r.error);
    },
  };
}

// ============================================================================
// 작은 섹션들
// ============================================================================

function BotSection({
  isHost,
  hasBots,
  bots,
  onOpenSetup,
}: {
  isHost: boolean;
  hasBots: boolean;
  bots: string[];
  onOpenSetup: () => void;
}) {
  return (
    <section className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-200">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          🤖 <b>AI 봇</b> —{' '}
          {hasBots ? (
            <>
              <b>{bots.length}명</b> 추가됨 ({bots.join(', ')})
            </>
          ) : (
            <>봇 없이 진행 (호스트가 추가 가능)</>
          )}
        </div>
        {isHost && (
          <button
            onClick={onOpenSetup}
            className="flex-shrink-0 rounded border border-emerald-400/60 bg-emerald-900/40 px-3 py-1 text-[11px] font-bold text-emerald-100 hover:bg-emerald-800/50"
          >
            {hasBots ? '봇 변경' : '봇 추가'}
          </button>
        )}
      </div>
    </section>
  );
}

function TestModeToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 rounded-lg border border-rose-500/40 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
      <span>
        🧪 <b>테스트 모드</b> — 손패 1장만 분배 (흐름 확인용, 추후 제거)
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 cursor-pointer accent-rose-400"
      />
    </label>
  );
}

function MediaModeBadge({ mode }: { mode: 'video' | 'voice-only' }) {
  const isVoice = mode === 'voice-only';
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
        isVoice
          ? 'border-sky-500/40 bg-sky-500/10 text-sky-200'
          : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
      }`}
    >
      <span>{isVoice ? '🎙️' : '🎥'}</span>
      <span>
        <b>미디어 모드</b> — {isVoice ? '음성 전용 (카메라 X)' : '화상 + 음성'}
      </span>
      <span className="ml-auto text-[10px] opacity-70">호스트가 룰 모달에서 변경 가능</span>
    </div>
  );
}

function GwangPaliSection({
  count,
  amVolunteer,
  onToggleVolunteer,
}: {
  count: number;
  amVolunteer: boolean;
  onToggleVolunteer: () => void;
}) {
  return (
    <section className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
      <div className="mb-1.5">
        🎴 <b>광팔이 모드</b> — 시작 시 {count}명이 빠집니다.
      </div>
      <div className="text-[11px] text-amber-300/80">
        자원자 → 호스트 지정 → 마지막 입장자 자동 순.
      </div>
      <button
        onClick={onToggleVolunteer}
        className={`mt-2 w-full rounded border px-3 py-1.5 text-xs font-bold transition ${
          amVolunteer
            ? 'border-amber-400 bg-amber-500/30 text-amber-100'
            : 'border-amber-500/40 bg-amber-950/40 text-amber-200 hover:bg-amber-900/50'
        }`}
      >
        {amVolunteer ? '✓ 광팔이 자원함 (취소)' : '나는 광팔이로 빠지기'}
      </button>
    </section>
  );
}
