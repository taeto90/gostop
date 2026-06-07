import type { PlayerStateView } from '@gostop/shared';
import { calculateScore } from '@gostop/shared';
import { Card } from '../../../components/Card.tsx';
import {
  groupCollected,
  KIND_COLORS,
  KIND_LABELS,
  type CollectedKind,
} from '../../../lib/collectedGroups.ts';
import { piValue } from '../../../lib/multiplierUtils.ts';

const CARD_W = 30;
const STEP = 15; // 50% 겹침

interface OpponentCollectedOverlayProps {
  opponents: PlayerStateView[];
  allowGukJoon: boolean;
  onClose: () => void;
}

/**
 * 모바일 — 상대 딴패 오버레이 (기본 접힘, 토글로 펼침).
 * 윗줄 [광][끗][띠] / 아랫줄 [피]. 3인이면 상대 2명 좌우 동시 표시.
 * 게임 레이아웃을 밀지 않고 위에 겹쳐서 표시 (fixed overlay).
 */
export function OpponentCollectedOverlay({
  opponents,
  allowGukJoon,
  onClose,
}: OpponentCollectedOverlayProps) {
  return (
    <div
      className="fixed inset-x-2 top-10 z-30 flex gap-2 rounded-xl border border-amber-500/40 bg-felt-950/95 p-2 shadow-2xl backdrop-blur-sm"
      onClick={onClose}
    >
      {opponents.map((p) => {
        const nineYeol = p.flags?.nineYeolAsSsangPi ?? false;
        const groups = groupCollected(p.collected, nineYeol);
        const score = calculateScore(p.collected, {
          nineYeolAsSsangPi: nineYeol,
          allowGukJoon,
        });
        const renderGroup = (kind: CollectedKind) => {
          const cards = groups[kind];
          const count = kind === 'pi' ? piValue(cards, nineYeol) : cards.length;
          return (
            <div key={kind} className="flex min-w-0 items-start gap-1">
              <div
                className={`flex flex-shrink-0 items-baseline gap-0.5 rounded border px-1 py-0.5 ${KIND_COLORS[kind]}`}
              >
                <span className="text-[11px] font-bold">{KIND_LABELS[kind]}</span>
                <span className="text-sm font-black">{count}</span>
              </div>
              <div className="flex min-w-0 items-center overflow-hidden">
                {cards.map((c, i) => (
                  <div key={c.id} style={i > 0 ? { marginLeft: STEP - CARD_W } : undefined}>
                    <Card card={c} width={CARD_W} layoutId={c.id} />
                  </div>
                ))}
              </div>
            </div>
          );
        };
        return (
          <div key={p.userId} className="min-w-0 flex-1">
            {/* 이름 + 점수 */}
            <div className="mb-1 flex items-center gap-1.5">
              <span className="text-lg leading-none">{p.emojiAvatar}</span>
              <span className="truncate text-sm font-bold text-felt-50">{p.nickname}</span>
              <span className="rounded bg-felt-900/80 px-1.5 text-base font-black text-amber-300">
                {score.total}점
              </span>
              <span className="text-xs text-felt-400">🂠 ×{p.handCount}장</span>
            </div>
            {/* 윗줄: 광/끗/띠 — 아랫줄: 피 */}
            <div className="flex flex-col gap-1">
              <div className="flex min-w-0 items-start gap-2">
                {(['gwang', 'yeol', 'ddi'] as const).map(renderGroup)}
              </div>
              <div className="flex min-w-0 items-start">{renderGroup('pi')}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
