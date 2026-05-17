import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { PlayerStateView } from '@gostop/shared';
import { calculateScore } from '@gostop/shared';
import { AnimatedNumber } from '../../../components/AnimatedNumber.tsx';
import { Card } from '../../../components/Card.tsx';
import { CollectedStrip } from '../../../components/CollectedStrip.tsx';
import { TurnIndicator } from '../../../components/TurnIndicator.tsx';
import { useElementSize } from '../../../hooks/useElementSize.ts';
import { computeMultiplier, multiplierBreakdown } from '../../../lib/multiplierUtils.ts';

/**
 * phase='waiting'에서 호스트가 다른 player slot 클릭 시 나오는 메뉴 액션.
 * 모든 액션 optional — 표시할 액션만 전달.
 */
export interface OpponentMenuActions {
  onAssignSpectator?: () => void;
  onAssignGwangPali?: () => void;
  isGwangPaliAssigned?: boolean;
  onTransferHost?: () => void;
  onKick?: () => void;
}

interface OpponentSlotProps {
  player: PlayerStateView;
  isCurrentTurn: boolean;
  allowGukJoon?: boolean;
  /** 본인 턴 30초+ 응답 없으면 💤 표시 */
  isAfk?: boolean;
  /** 이 player turn 카운트다운 (본인 turn일 때만 set, 그 외 null) */
  remainingSec?: number | null;
  /**
   * 클릭 시 popover로 노출할 호스트 컨트롤 액션. 정의되어 있을 때만 클릭 가능 + 메뉴 표시.
   * 게임 진행 중에는 보통 undefined로 전달해 클릭 비활성화.
   */
  menuActions?: OpponentMenuActions;
}

/**
 * 상대방 슬롯 - 컴팩트한 가로 레이아웃, 화면 크기 반응형.
 */
export function OpponentSlot({
  player,
  isCurrentTurn,
  allowGukJoon = true,
  isAfk = false,
  remainingSec = null,
  menuActions,
}: OpponentSlotProps) {
  const score = calculateScore(player.collected, {
    nineYeolAsSsangPi: player.flags?.nineYeolAsSsangPi ?? false,
    allowGukJoon,
  });
  const [containerRef, { width: cw }] = useElementSize<HTMLElement>();

  // 좁은 화면에선 손패 표시 안 하고 카운트만
  const compact = cw > 0 && cw < 280;
  const handCardWidth = compact ? 0 : cw < 380 ? 24 : 32;

  // phase='waiting' 호스트 컨트롤 메뉴 — 클릭 시에만 노출 (처음에는 숨김)
  const [menuOpen, setMenuOpen] = useState(false);
  const hasMenuActions =
    menuActions !== undefined &&
    (menuActions.onAssignSpectator !== undefined ||
      menuActions.onAssignGwangPali !== undefined ||
      menuActions.onTransferHost !== undefined ||
      menuActions.onKick !== undefined);

  // 외부 클릭 / ESC로 메뉴 닫기 (containerRef는 useElementSize 공유)
  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen, containerRef]);

  function handleSlotClick() {
    if (!hasMenuActions) return;
    setMenuOpen((prev) => !prev);
  }

  function runAndClose(fn?: () => void) {
    if (!fn) return;
    setMenuOpen(false);
    fn();
  }

  return (
    <section
      ref={containerRef}
      // 고정 height — 헤더(30) + 손패 face-down(52) + collected(52) + gap+padding(36) ≈ 170
      className={`relative flex h-[170px] flex-col gap-1.5 overflow-visible rounded-lg border p-1.5 transition sm:p-2 ${
        isCurrentTurn
          ? 'border-amber-400/60 bg-amber-400/10 shadow-[0_0_12px_rgba(251,191,36,0.25)]'
          : 'border-felt-900/60 bg-felt-900/40'
      } ${!player.connected ? 'opacity-40' : ''} ${
        hasMenuActions ? 'cursor-pointer hover:border-amber-400/40' : ''
      }`}
      onClick={handleSlotClick}
      role={hasMenuActions ? 'button' : undefined}
      aria-haspopup={hasMenuActions ? 'menu' : undefined}
      aria-expanded={hasMenuActions ? menuOpen : undefined}
    >
      {/* 헤더: 아바타 + 닉네임 + 배지/턴 마커 (점수는 collected 왼쪽으로 이동) */}
      <header className="flex items-center gap-2">
        <span className="text-xl sm:text-2xl">{player.emojiAvatar}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="truncate text-xs font-semibold text-felt-50 sm:text-sm">
              {player.nickname}
            </span>
            {isAfk && (
              <span title="응답 없음 — 자리 비움 가능성" className="text-xs">
                💤
              </span>
            )}
            {player.flags?.shookMonths?.map((m) => (
              <span
                key={m}
                title={`${m}월 흔들기 — 점수 ×2`}
                className="rounded bg-amber-500/30 px-1 text-[10px] font-bold text-amber-100"
              >
                💪{m}월
              </span>
            ))}
            {player.flags?.bombs && player.flags.bombs > 0 ? (
              <span
                title={`폭탄 ${player.flags.bombs}개`}
                className="rounded bg-rose-500/30 px-1 text-[10px] font-bold text-rose-100"
              >
                💣{player.flags.bombs}
              </span>
            ) : null}
            {player.goCount > 0 && (
              <span
                title={`${player.goCount}고 진행 중`}
                className="rounded-full bg-rose-500/80 px-1.5 py-0.5 text-[10px] font-black text-white shadow-sm"
              >
                {player.goCount}고
              </span>
            )}
            <TurnIndicator isCurrent={isCurrentTurn} goCount={0} />
            {/* 상대 turn 카운트다운 — server timer 기반, 5초 이하면 빨간 pulse */}
            {remainingSec !== null && (
              <span
                className={`ml-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                  remainingSec <= 5
                    ? 'bg-rose-500/30 text-rose-200 animate-pulse'
                    : 'bg-felt-950/70 text-felt-200'
                }`}
              >
                ⏱ {remainingSec}
              </span>
            )}
          </div>
          {!player.connected && (
            <span className="text-[10px] text-rose-300">재접속 중...</span>
          )}
        </div>
      </header>

      {/* 손패 (압축 모드면 카운트만)
          Card에 layoutId 전달 — AI/상대 turn Phase 1-B에서 fake hand 카드가 source가 되어
          바닥으로 layoutId 비행 가능 (phaseViews.buildPhase1ViewWithFakeHand로 mount). */}
      {compact ? (
        <div className="text-[11px] text-felt-300">손패 {player.handCount}장</div>
      ) : (
        <div className="flex items-center gap-0.5">
          {player.hand
            ? player.hand.map((c) => (
                <Card key={c.id} card={c} width={handCardWidth} layoutId={c.id} />
              ))
            : Array.from({ length: player.handCount }).map((_, i) => (
                <Card key={i} faceDown width={handCardWidth} />
              ))}
        </div>
      )}

      {/* 점수(왼쪽) + 딴패(오른쪽) — 한 줄로 배치. 비어 있어도 공간 미리 확보. */}
      <div className="flex min-h-[56px] flex-1 items-center gap-2 border-t border-felt-900/60 pt-1">
        <div className="flex shrink-0 flex-col items-center justify-center rounded-lg border border-amber-400/30 bg-felt-950/60 px-2 py-1">
          <div className="flex items-baseline gap-0.5">
            <AnimatedNumber
              value={score.total}
              className="text-2xl font-black text-amber-300 drop-shadow-[0_0_6px_rgba(252,211,77,0.5)] sm:text-3xl"
            />
            <span className="text-[10px] font-bold text-felt-300">점</span>
          </div>
          {(() => {
            const m = computeMultiplier(player);
            return m > 1 ? (
              <span
                title={multiplierBreakdown(player)}
                className="rounded bg-amber-500/40 px-1 text-[10px] font-black text-amber-100"
              >
                ×{m}
              </span>
            ) : null;
          })()}
        </div>
        <div className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
          <CollectedStrip
            collected={player.collected}
            size="xs"
            density="compact"
            nineYeolAsSsangPi={player.flags?.nineYeolAsSsangPi ?? false}
          />
        </div>
      </div>

      {/* 호스트 컨트롤 popover — phase='waiting'에서 클릭 시에만 노출 */}
      <AnimatePresence>
        {menuOpen && hasMenuActions && (
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
              <MenuItem
                onClick={() => runAndClose(menuActions.onAssignSpectator)}
                color="sky"
              >
                👁️ 관전자로 지정
              </MenuItem>
            )}
            {menuActions?.onAssignGwangPali && (
              <MenuItem
                onClick={() => runAndClose(menuActions.onAssignGwangPali)}
                color="amber"
                active={menuActions.isGwangPaliAssigned}
              >
                🎴{' '}
                {menuActions.isGwangPaliAssigned
                  ? '광팔이 지정 해제'
                  : '광팔이 지정'}
              </MenuItem>
            )}
            {menuActions?.onTransferHost && (
              <MenuItem
                onClick={() => runAndClose(menuActions.onTransferHost)}
                color="amber"
              >
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
    </section>
  );
}

function MenuItem({
  onClick,
  children,
  color,
  active = false,
}: {
  onClick: () => void;
  children: React.ReactNode;
  color: 'sky' | 'amber' | 'rose';
  active?: boolean;
}) {
  const colors = {
    sky: 'text-sky-200 hover:bg-sky-500/20',
    amber: 'text-amber-200 hover:bg-amber-500/20',
    rose: 'text-rose-200 hover:bg-rose-500/20',
  };
  return (
    <button
      onClick={onClick}
      role="menuitem"
      className={`rounded px-3 py-1.5 text-left text-xs font-bold transition ${colors[color]} ${
        active ? 'bg-amber-500/30' : ''
      }`}
    >
      {children}
    </button>
  );
}
