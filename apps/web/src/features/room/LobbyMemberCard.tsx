import { memo, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
// motion은 popover 메뉴 애니메이션에만 사용 — mount/unmount는 부모 grid가 wrapper로 처리

/**
 * RoomLobbyModal에서 사용하는 멤버 카드 — 드래그 가능 + 클릭 시 팝오버 메뉴.
 *
 * 드래그&드롭은 HTML5 native API. 모바일에서는 native touch DnD 미지원이므로
 * 클릭 → 메뉴에서 "관전자로/플레이어로" 옵션으로 동등한 흐름 제공.
 */
export interface LobbyMemberMenuActions {
  /** player → spectator (호스트만 또는 본인) */
  onAssignSpectator?: () => void;
  /** spectator → player (호스트만 또는 본인) */
  onAssignPlayer?: () => void;
  /** 방장 권한 위임 (호스트만, 다른 player에게) */
  onTransferHost?: () => void;
  /** 강퇴 (호스트만) */
  onKick?: () => void;
  /**
   * 광팔이 지정/해제 (호스트만, 4~5명일 때 player에게).
   * `assigned` 현재 지정 여부에 따라 토글로 동작.
   */
  onToggleGwangPali?: { assigned: boolean; toggle: () => void };
}

interface LobbyMemberCardProps {
  userId: string;
  emoji: string;
  nickname: string;
  isHost: boolean;
  isMe: boolean;
  isSpectator: boolean;
  isVolunteer?: boolean;
  /** 호스트가 지정한 광팔이 (volunteer와 별도) */
  isGwangPaliAssigned?: boolean;
  /** HTML5 드래그 가능 여부 */
  draggable?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  /** 정의 시 이 card가 drop target — 다른 card가 자기 위에 드롭됨 (player 순서 변경용) */
  onDropTarget?: () => void;
  /** drop target 활성 시 시각 강조 */
  isDropHover?: boolean;
  onDragOverTarget?: () => void;
  onDragLeaveTarget?: () => void;
  /** 정의 시 클릭 → popover 메뉴. 모든 액션 optional, 정의된 것만 노출 */
  menuActions?: LobbyMemberMenuActions;
}

export const LobbyMemberCard = memo(function LobbyMemberCard({
  userId,
  emoji,
  nickname,
  isHost,
  isMe,
  isSpectator,
  isVolunteer,
  isGwangPaliAssigned,
  draggable = false,
  onDragStart,
  onDragEnd,
  onDropTarget,
  isDropHover,
  onDragOverTarget,
  onDragLeaveTarget,
  menuActions,
}: LobbyMemberCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const hasMenu =
    menuActions !== undefined &&
    (menuActions.onAssignSpectator !== undefined ||
      menuActions.onAssignPlayer !== undefined ||
      menuActions.onTransferHost !== undefined ||
      menuActions.onKick !== undefined ||
      menuActions.onToggleGwangPali !== undefined);

  // 외부 클릭 / ESC로 메뉴 닫기
  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (!cardRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  function handleClick() {
    if (!hasMenu) return;
    setMenuOpen((v) => !v);
  }

  function runAndClose(fn?: () => void) {
    if (!fn) return;
    setMenuOpen(false);
    fn();
  }

  function handleDragStart(e: React.DragEvent<HTMLDivElement>) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/userId', userId);
    onDragStart?.();
  }

  // mount/unmount 애니메이션은 부모 PlayerGrid/SpectatorGrid의 AnimatePresence + motion.div가 담당.
  // 여기서는 plain div만 — AnimatePresence가 functional component를 통과하지 못해
  // unmount detection이 깨지는 문제 회피.
  return (
    <div
      ref={cardRef}
      role={hasMenu ? 'button' : undefined}
      aria-haspopup={hasMenu ? 'menu' : undefined}
      aria-expanded={hasMenu ? menuOpen : undefined}
      onClick={handleClick}
      draggable={draggable}
      onDragStart={draggable ? handleDragStart : undefined}
      onDragEnd={draggable ? onDragEnd : undefined}
      onDragOver={
        onDropTarget
          ? (e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              onDragOverTarget?.();
            }
          : undefined
      }
      onDragLeave={onDropTarget ? onDragLeaveTarget : undefined}
      onDrop={
        onDropTarget
          ? (e) => {
              e.preventDefault();
              e.stopPropagation();
              onDropTarget();
            }
          : undefined
      }
      className={`relative flex items-center gap-2 rounded-lg border p-2 transition ${
        isMe
          ? 'border-emerald-500/50 bg-emerald-500/10'
          : isSpectator
            ? 'border-slate-700/60 bg-slate-900/40'
            : 'border-felt-800 bg-felt-900/40'
      } ${hasMenu ? 'cursor-pointer hover:border-amber-400/50' : ''} ${
        draggable ? 'active:opacity-60' : ''
      } ${isDropHover ? 'ring-2 ring-sky-400 ring-offset-1 ring-offset-felt-950' : ''}`}
    >
      <span className="text-2xl">{emoji}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-semibold text-felt-50">
          {nickname}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-1 text-[9px]">
          {isMe && (
            <span className="rounded bg-emerald-500/20 px-1 text-emerald-200">
              나
            </span>
          )}
          {isHost && (
            <span className="rounded bg-amber-500/25 px-1 text-amber-200">
              호스트
            </span>
          )}
          {isSpectator && (
            <span className="rounded bg-slate-500/20 px-1 text-slate-300">
              관전
            </span>
          )}
          {isVolunteer && (
            <span className="rounded bg-amber-500/30 px-1 text-amber-200">
              광팔이 자원
            </span>
          )}
          {isGwangPaliAssigned && !isVolunteer && (
            <span className="rounded bg-amber-500/40 px-1 text-amber-100">
              광팔이 지정
            </span>
          )}
        </div>
      </div>

      {/* 클릭 popover 메뉴 */}
      <AnimatePresence>
        {menuOpen && hasMenu && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            role="menu"
            onClick={(e) => e.stopPropagation()}
            className="absolute right-1 top-full z-30 mt-1 flex min-w-[140px] flex-col gap-0.5 rounded-lg border border-amber-500/40 bg-felt-950/95 p-1 shadow-[0_8px_20px_rgba(0,0,0,0.4)] backdrop-blur-sm"
          >
            {menuActions?.onAssignSpectator && (
              <MenuItem onClick={() => runAndClose(menuActions.onAssignSpectator)} color="sky">
                👁️ 관전자로 이동
              </MenuItem>
            )}
            {menuActions?.onAssignPlayer && (
              <MenuItem onClick={() => runAndClose(menuActions.onAssignPlayer)} color="emerald">
                🎮 플레이어로 이동
              </MenuItem>
            )}
            {menuActions?.onToggleGwangPali && (
              <MenuItem
                onClick={() => runAndClose(menuActions.onToggleGwangPali!.toggle)}
                color="amber"
              >
                {menuActions.onToggleGwangPali.assigned
                  ? '🎴 광팔이 지정 해제'
                  : '🎴 광팔이로 지정'}
              </MenuItem>
            )}
            {menuActions?.onTransferHost && (
              <MenuItem onClick={() => runAndClose(menuActions.onTransferHost)} color="amber">
                👑 방장 위임
              </MenuItem>
            )}
            {menuActions?.onKick && (
              <MenuItem onClick={() => runAndClose(menuActions.onKick)} color="rose">
                🚪 강퇴
              </MenuItem>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

function MenuItem({
  onClick,
  children,
  color,
}: {
  onClick: () => void;
  children: React.ReactNode;
  color: 'sky' | 'amber' | 'rose' | 'emerald';
}) {
  const colors = {
    sky: 'text-sky-200 hover:bg-sky-500/20',
    amber: 'text-amber-200 hover:bg-amber-500/20',
    rose: 'text-rose-200 hover:bg-rose-500/20',
    emerald: 'text-emerald-200 hover:bg-emerald-500/20',
  };
  return (
    <button
      onClick={onClick}
      role="menuitem"
      className={`rounded px-3 py-1.5 text-left text-xs font-bold transition ${colors[color]}`}
    >
      {children}
    </button>
  );
}
