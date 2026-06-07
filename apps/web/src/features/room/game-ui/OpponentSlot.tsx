import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { PlayerStateView } from '@gostop/shared';
import { calculateScore } from '@gostop/shared';
import { AnimatedNumber } from '../../../components/AnimatedNumber.tsx';
import { Card } from '../../../components/Card.tsx';
import {
  OPPONENT_COLLECTED_CARD_WIDTH,
  OPPONENT_HAND_MINI_WIDTH,
} from '../../../lib/layoutConstants.ts';
import { computeMultiplier } from '../../../lib/multiplierUtils.ts';
import { CollectedGroupsRow } from './CollectedGroupsRow.tsx';

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
  /** 선(첫 턴) 플레이어 — players[0] */
  isFirstPlayer?: boolean;
  /** 3인 모드 — 프로필 블록 축소 (공간 확보) */
  dense?: boolean;
  /** 본인 턴 30초+ 응답 없으면 💤 표시 */
  isAfk?: boolean;
  /** 이 player turn 카운트다운 (본인 turn일 때만 set, 그 외 null) */
  remainingSec?: number | null;
  /**
   * 클릭 시 popover로 노출할 호스트 컨트롤 액션. 정의되어 있을 때만 클릭 가능 + 메뉴 표시.
   * 게임 진행 중에는 보통 undefined로 전달해 클릭 비활성화.
   */
  menuActions?: OpponentMenuActions;
  onScoreClick?: () => void;
}

/**
 * 상대방 보드 (2026-06 시니어 친화 개편 — PC 전용).
 *
 * [아바타·이름·선 / 점수(大)·N고·⏱ / 🂠 N장] | [광 N 끗 N 띠 N 피 N — 내 딴패와 동일 크기 1행]
 *
 * ⚠️ 손패는 텍스트(N장)로만 표시하지만, staging이 주입하는 fake-hand 카드(`player.hand`)는
 *    상대 turn Phase 1-B 비행의 layoutId source — 텍스트 옆에 잠깐 렌더됨. 제거 금지.
 */
export function OpponentSlot({
  player,
  isCurrentTurn,
  allowGukJoon = true,
  isFirstPlayer = false,
  dense = false,
  isAfk = false,
  remainingSec = null,
  menuActions,
  onScoreClick,
}: OpponentSlotProps) {
  const nineYeol = player.flags?.nineYeolAsSsangPi ?? false;
  const score = calculateScore(player.collected, {
    nineYeolAsSsangPi: nineYeol,
    allowGukJoon,
  });
  const multiplier = computeMultiplier(player);

  const containerRef = useRef<HTMLElement>(null);

  // phase='waiting' 호스트 컨트롤 메뉴 — 클릭 시에만 노출 (처음에는 숨김)
  const [menuOpen, setMenuOpen] = useState(false);
  const hasMenuActions =
    menuActions !== undefined &&
    (menuActions.onAssignSpectator !== undefined ||
      menuActions.onAssignGwangPali !== undefined ||
      menuActions.onTransferHost !== undefined ||
      menuActions.onKick !== undefined);

  // 외부 클릭 / ESC로 메뉴 닫기
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
  }, [menuOpen]);

  function handleSlotClick() {
    if (!hasMenuActions) return;
    setMenuOpen((prev) => !prev);
  }

  function runAndClose(fn?: () => void) {
    if (!fn) return;
    setMenuOpen(false);
    fn();
  }

  // 분리 패널 톤 — 정보 패널은 진한 그린, 딴패 패널은 한 단계 밝은 다크그린 (시각 구분).
  // 현재 턴이면 두 패널 모두 amber 강조.
  const infoPanelCls = isCurrentTurn
    ? 'border-amber-400/70 bg-felt-950/85 shadow-[0_0_14px_rgba(251,191,36,0.35)]'
    : 'border-felt-800/70 bg-felt-950/85';
  const collectedPanelCls = isCurrentTurn
    ? 'border-amber-400/50 bg-felt-900/60'
    : 'border-felt-800/60 bg-felt-900/60';

  return (
    <section
      ref={containerRef}
      // 고정 height — 카드 누적되어도 layout 안 흔들림
      // 높이 = 라벨 + 카드 2줄 기준. 3줄 이상이면 '고' 배지처럼 경계 밖으로 넘침 (overflow-visible)
      className={`relative flex h-[186px] items-stretch gap-2 overflow-visible ${
        !player.connected ? 'opacity-40' : ''
      } ${hasMenuActions ? 'cursor-pointer' : ''}`}
      onClick={handleSlotClick}
      role={hasMenuActions ? 'button' : undefined}
      aria-haspopup={hasMenuActions ? 'menu' : undefined}
      aria-expanded={hasMenuActions ? menuOpen : undefined}
    >
      {/* 좌측 정보 패널 — [아바타+이름] / [점수(大) + 남은 패] (진한 그린). dense=3인 축소 */}
      <div
        // justify-evenly — 줄 수(2~3)와 무관하게 위아래 여백을 줄 사이로 분배
        className={`flex flex-shrink-0 flex-col justify-evenly rounded-xl border transition ${
          dense ? 'px-2 py-1' : 'px-3 py-1.5'
        } ${infoPanelCls} ${hasMenuActions ? 'hover:border-amber-400/40' : ''}`}
      >
        {/* 이름 줄 */}
        <div className="flex items-center gap-2">
          <span className={`leading-none ${dense ? 'text-2xl' : 'text-3xl'}`}>
            {player.emojiAvatar}
          </span>
          <span
            className={`truncate font-bold text-felt-50 ${
              dense ? 'max-w-24 text-base' : 'max-w-36 text-lg'
            }`}
          >
            {player.nickname}
          </span>
          {isFirstPlayer && (
            <span
              title="선 — 첫 턴 플레이어"
              className="flex-shrink-0 rounded-full bg-rose-500/90 px-2 py-0.5 text-sm font-black text-white"
            >
              선
            </span>
          )}
          {isAfk && (
            <span title="응답 없음 — 자리 비움 가능성" className="text-base">
              💤
            </span>
          )}
          {player.flags?.shookMonths?.map((m) => (
            <span
              key={m}
              title={`${m}월 흔들기 — 점수 ×2`}
              className="rounded bg-amber-500/30 px-1 text-sm font-bold text-amber-100"
            >
              💪{m}월
            </span>
          ))}
          {player.flags?.bombs && player.flags.bombs > 0 ? (
            <span
              title={`폭탄 ${player.flags.bombs}개`}
              className="rounded bg-rose-500/30 px-1 text-sm font-bold text-rose-100"
            >
              💣{player.flags.bombs}
            </span>
          ) : null}
          {!player.connected && (
            <span className="text-sm text-rose-300">재접속 중...</span>
          )}
        </div>

        {/* 점수 + 남은 패 줄 */}
        <div className={`flex items-center ${dense ? 'gap-2' : 'gap-3'}`}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onScoreClick?.();
            }}
            className={`flex items-baseline gap-1 rounded-lg border border-amber-400/30 bg-felt-950/70 ${
              dense ? 'px-2 py-0.5' : 'px-3 py-1'
            } ${onScoreClick ? 'cursor-pointer hover:border-amber-400/70' : ''}`}
            title="점수 상세 보기"
          >
            <AnimatedNumber
              value={score.total}
              className={`font-black text-amber-300 drop-shadow-[0_0_6px_rgba(252,211,77,0.5)] ${
                dense ? 'text-3xl' : 'text-4xl'
              }`}
            />
            <span className="text-sm font-bold text-felt-300">점</span>
          </button>
          {/* 남은 손패 — 더미와 같은 카드 뒷면 + 장수 */}
          <div className="flex items-center gap-1.5" title={`남은 손패 ${player.handCount}장`}>
            <Card faceDown width={dense ? 22 : 26} />
            <span
              className={`whitespace-nowrap font-bold text-felt-100 ${
                dense ? 'text-base' : 'text-lg'
              }`}
            >
              ×{player.handCount}장
            </span>
          </div>
          {multiplier > 1 && (
            <span className="rounded bg-amber-500/40 px-1.5 py-0.5 text-base font-black text-amber-100">
              ×{multiplier}
            </span>
          )}
          {remainingSec !== null && (
            <span
              className={`rounded px-1.5 py-0.5 text-base font-bold ${
                remainingSec <= 5
                  ? 'bg-rose-500/30 text-rose-200 animate-pulse'
                  : 'bg-felt-950/70 text-felt-200'
              }`}
            >
              ⏱ {remainingSec}
            </span>
          )}
        </div>

        {/* 고 배지 줄 — 점수 아래 */}
        {player.goCount > 0 && (
          <div className="flex items-center">
            <span
              title={`${player.goCount}고 진행 중`}
              className={`rounded-full bg-rose-500/90 font-black text-white shadow-[0_0_10px_rgba(244,63,94,0.6)] ${
                dense ? 'px-2 py-0.5 text-base' : 'px-2.5 py-0.5 text-lg'
              }`}
            >
              {player.goCount}고
            </span>
          </div>
        )}
      </div>

      {/* fake-hand 카드(staging 주입) — 비행 source. absolute라 레이아웃 영향 X, 비행 직전 잠깐만 보임 */}
      {player.hand && player.hand.length > 0 && (
        <div className="absolute bottom-2 left-3 z-10 flex items-center gap-1">
          {player.hand.map((c) => (
            <Card key={c.id} card={c} width={OPPONENT_HAND_MINI_WIDTH} layoutId={c.id} />
          ))}
        </div>
      )}


      {/* 우측 딴패 패널 — 라벨 상단 + 줄 규칙(광/끗/띠 5장·피 10장). 3줄+는 아래로 넘침 */}
      <div
        className={`flex min-w-0 flex-1 items-start rounded-xl border p-2 pl-3 transition ${collectedPanelCls}`}
      >
        <CollectedGroupsRow
          collected={player.collected}
          nineYeolAsSsangPi={nineYeol}
          cardW={OPPONENT_COLLECTED_CARD_WIDTH}
        />
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
