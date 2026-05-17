import { useMemo } from 'react';
import type { Card as CardType } from '@gostop/shared';
import { motion } from 'framer-motion';
import { Card } from '../../../components/Card.tsx';
import { useElementSize } from '../../../hooks/useElementSize.ts';
import { handDealDelay } from '../../../lib/dealingPattern.ts';

const KIND_ORDER: Record<string, number> = { gwang: 0, yeol: 1, ddi: 2, pi: 3 };

/**
 * 손패 표시 정렬 — 월 오름차순(1→12) → 같은 월 내 광/끗/띠/피.
 * 폭탄/조커 등 특수 카드는 일반 카드 뒤에 별도 그룹.
 */
function sortHandForDisplay(hand: readonly CardType[]): CardType[] {
  const normal: CardType[] = [];
  const special: CardType[] = [];
  for (const c of hand) {
    if (c.isBomb || c.isJoker) special.push(c);
    else normal.push(c);
  }
  normal.sort((a, b) => {
    if (a.month !== b.month) return a.month - b.month;
    const ka = KIND_ORDER[a.kind] ?? 9;
    const kb = KIND_ORDER[b.kind] ?? 9;
    if (ka !== kb) return ka - kb;
    return a.id.localeCompare(b.id);
  });
  return [...normal, ...special];
}
import {
  HAND_CARD_GAP,
  HAND_CARD_MAX_WIDTH,
  HAND_CARD_MIN_WIDTH,
} from '../../../lib/layoutConstants.ts';

interface MyHandProps {
  hand: CardType[];
  matchableIds: Set<string>;
  isMyTurn: boolean;
  onPlayCard?: (cardId: string) => void;
  /** 모바일/좁은 화면 모드 — 카드 크기 캡 작게 */
  compact?: boolean;
  /** Phase 1-A에서 그 자리에서 확대되는 카드 ID */
  peakingCardId?: string | null;
  /** 테스트 모드 트리거 카드 ID들 — pulse rose ring으로 강조 */
  triggerIds?: Set<string>;
}

/**
 * 내 손패 - 화면 하단 일자 정렬, 컨테이너 너비/높이에 맞춰 반응형.
 */
export function MyHand({
  hand,
  matchableIds,
  isMyTurn,
  onPlayCard,
  compact = false,
  peakingCardId = null,
  triggerIds,
}: MyHandProps) {
  const [containerRef, { width: cw, height: ch }] = useElementSize<HTMLDivElement>();
  // 손패는 월 오름차순(1→12) + 같은 월 내 광/끗/띠/피 순으로 표시.
  // layoutId 보간이 자동 — 정렬 후 위치 변경도 부드럽게 비행.
  const displayHand = useMemo(() => sortHandForDisplay(hand), [hand]);

  if (hand.length === 0) {
    return (
      <div
        ref={containerRef}
        className="flex items-center justify-center text-sm italic text-felt-300/60"
        style={{ minHeight: 40 }}
      >
        손패 없음
      </div>
    );
  }

  const total = hand.length;

  // 카드 크기 — width와 height 둘 다 고려. matchable ring(5px+offset) + glow + translate-y 침범 방지.
  const padding = compact ? 4 : 12;
  const ringBuffer = 24; // ring-[5px] + offset-2 + glow + -translate-y-1.5 여유
  const availableWidth = cw > 0 ? cw - padding : 700;
  const availableHeight = ch > 0 ? ch - ringBuffer : compact ? 90 : 150;
  const widthBased = (availableWidth - (total - 1) * HAND_CARD_GAP) / total;
  const heightBased = availableHeight / 1.63;
  const cap = compact ? HAND_CARD_MAX_WIDTH.mobile : HAND_CARD_MAX_WIDTH.pc;
  const cardW = Math.max(HAND_CARD_MIN_WIDTH, Math.min(cap, widthBased, heightBased));

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full items-center justify-center"
      style={{ gap: HAND_CARD_GAP }}
    >
      {displayHand.map((c, i) => (
        // 부모 div는 transform-free — 자식 Card(layoutId)의 비행 보간을 방해하지 않도록.
        // 정통 4-3-3 분배 패턴 stagger (3인 4장→3장, 2인 5장→5장).
        <motion.div
          key={c.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            delay: handDealDelay(i, hand.length),
            duration: 0.22,
            ease: 'easeOut',
          }}
        >
          <Card
            card={c}
            width={cardW}
            layoutId={c.id}
            highlight={
              triggerIds?.has(c.id)
                ? 'trigger'
                : matchableIds.has(c.id)
                  ? 'matchable'
                  : 'none'
            }
            peakScale={peakingCardId === c.id}
            onClick={isMyTurn && onPlayCard ? () => onPlayCard(c.id) : undefined}
          />
        </motion.div>
      ))}
    </div>
  );
}
