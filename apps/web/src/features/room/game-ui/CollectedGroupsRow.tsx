import type { Card as CardType } from '@gostop/shared';
import { AnimatedNumber } from '../../../components/AnimatedNumber.tsx';
import { Card } from '../../../components/Card.tsx';
import { useElementSize } from '../../../hooks/useElementSize.ts';
import {
  COLLECTED_KINDS,
  groupCollected,
  KIND_COLORS,
  KIND_LABELS,
} from '../../../lib/collectedGroups.ts';
import { piValue } from '../../../lib/multiplierUtils.ts';

interface CollectedGroupsRowProps {
  collected: CardType[];
  nineYeolAsSsangPi: boolean;
  /** 카드 너비 상한 (px) — 폭이 부족하면 50% 겹침을 유지한 채 자동 축소 (최소 32) */
  cardW: number;
}

/** 그룹 컬럼 사이 gap (px) */
const WRAP_GROUP_GAP = 12;

/** 피 카드 1장의 가치 (쌍피=2, 쓰리피=3, 9월 끗 변환=2) — 줄당 10점 청킹용 */
function cardPiValue(c: CardType, nineYeolAsSsangPi: boolean): number {
  if (c.bonusPiValue === 3) return 3;
  if (c.isSsangPi) return 2;
  if (nineYeolAsSsangPi && c.id === 'm09-yeol') return 2;
  return 1;
}

/**
 * 상대 보드 딴패 그룹 (광/끗/띠/피) — 라벨 상단 + 줄 규칙(광/끗/띠 5장·피 10점/줄).
 *
 * 겹침은 **항상 50% 고정** (2인/3인 동일). 폭이 부족하면 카드 크기를 줄여서 맞춤:
 *   3×(c + 4·c/2) + (c + 9·c/2) + 3×gap = roww  →  c = (roww − 3·gap) / 14.5
 * 3줄 이상은 컴포넌트 경계 밖으로 넘침 허용 (overflow-visible — '고' 배지처럼).
 * 카드 `layoutId={c.id}` — Phase 4 점수판 비행 도착지 (wrapper transform-free).
 */
export function CollectedGroupsRow({
  collected,
  nineYeolAsSsangPi,
  cardW,
}: CollectedGroupsRowProps) {
  const groups = groupCollected(collected, nineYeolAsSsangPi);
  const [rowRef, { width: roww }] = useElementSize<HTMLDivElement>();

  // 50% 겹침 고정 — 광/끗/띠 5장 + 피 10장이 한 줄에 들어가는 카드 크기 산출
  const effCardW =
    roww > 0
      ? Math.max(32, Math.min(cardW, Math.floor((roww - 3 * WRAP_GROUP_GAP) / 14.5)))
      : cardW;
  const step = Math.round(effCardW / 2); // 보이는 폭 = 카드의 50%
  const cardH = Math.round(effCardW * 1.63);
  const colW = (slots: number) => effCardW + (slots - 1) * step;

  return (
    <div ref={rowRef} className="flex min-w-0 flex-1 items-start" style={{ gap: WRAP_GROUP_GAP }}>
      {COLLECTED_KINDS.map((kind) => {
        const cards = groups[kind];
        const count =
          kind === 'pi' ? piValue(cards, nineYeolAsSsangPi) : cards.length;
        // 줄 청킹 — 광/끗/띠: 5장 / 피: 누적 가치 10점
        const rows: CardType[][] = [];
        if (kind === 'pi') {
          let cur: CardType[] = [];
          let sum = 0;
          for (const c of cards) {
            cur.push(c);
            sum += cardPiValue(c, nineYeolAsSsangPi);
            if (sum >= 10) {
              rows.push(cur);
              cur = [];
              sum = 0;
            }
          }
          if (cur.length > 0) rows.push(cur);
        } else {
          for (let i = 0; i < cards.length; i += 5) {
            rows.push(cards.slice(i, i + 5));
          }
        }
        return (
          <div
            key={kind}
            className="flex flex-shrink-0 flex-col items-start gap-1"
            style={{ width: colW(kind === 'pi' ? 10 : 5) }}
          >
            {/* 라벨 — 상단 가로 chip (광 2) */}
            <div
              className={`flex items-baseline gap-1 rounded-md border px-1.5 py-0.5 ${KIND_COLORS[kind]}`}
            >
              <span className="text-sm font-bold">{KIND_LABELS[kind]}</span>
              <AnimatedNumber value={count} className="text-lg font-black" />
            </div>
            {cards.length > 0 ? (
              // 3줄 이상은 컴포넌트 경계 밖으로 넘침 허용 (overflow-hidden 없음)
              <div className="flex flex-col items-start gap-0.5">
                {rows.map((row, ri) => (
                  <div key={ri} className="flex items-center">
                    {row.map((c, i) => (
                      <div
                        key={c.id}
                        style={i > 0 ? { marginLeft: step - effCardW } : undefined}
                      >
                        <Card card={c} width={effCardW} layoutId={c.id} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div
                className="flex-shrink-0 rounded border border-dashed border-felt-700/40"
                style={{ width: effCardW, height: cardH }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
