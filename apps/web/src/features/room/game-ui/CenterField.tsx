import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Card as CardType } from '@gostop/shared';
import { AnimatedNumber } from '../../../components/AnimatedNumber.tsx';
import { Card } from '../../../components/Card.tsx';
import { useElementSize } from '../../../hooks/useElementSize.ts';
import { fieldDealDelay } from '../../../lib/dealingPattern.ts';
import {
  applySpeed,
  FLIP_DURATION,
  FLIP_PEAK_SCALE,
  FLY_TO_SLOT_DURATION,
  SCALE_PEAK_DURATION,
} from '../../../lib/animationTiming.ts';
import { getLayoutDuration, useAnimationPhase } from '../../../lib/animationContext.ts';
import type { FlippingPhase } from '../../../hooks/useMultiTurnSequence.ts';
import {
  FIELD_CARD_MAX_WIDTH,
  FIELD_CARD_MIN_WIDTH,
  FIELD_HORIZONTAL_GAP_RATIO,
  FIELD_MOBILE_FAR_FACTOR_H,
  FIELD_MOBILE_ROW_DISTANCE_RATIO,
  FIELD_STACK_OFFSET_RATIO,
  FIELD_VERTICAL_GAP_RATIO,
} from '../../../lib/layoutConstants.ts';

interface CenterFieldProps {
  field: CardType[];
  deckCount: number;
  /** Phase 3: 더미에서 새로 등장하는 카드 ID — flip + 확대 + 축소 효과 적용 */
  flippingCardId?: string | null;
  /** Phase 3 sub-phase — flip/peak/fly에 따라 floating overlay animate target 분기 */
  flippingPhase?: FlippingPhase;
  /** 모바일 가로 모드 — 2행 4열 배치 (PC는 6각형 + 코너 4개) */
  isCompact?: boolean;
}

interface FieldLayoutItem {
  card: CardType;
  slot: number;
  indexInMonth: number;
  groupSize: number;
}

function useFieldLayout(field: readonly CardType[]): FieldLayoutItem[] {
  const monthToSlot = useRef(new Map<number, number>());

  const currentMonths = new Set<number>(field.map((c) => c.month));
  for (const m of [...monthToSlot.current.keys()]) {
    if (!currentMonths.has(m)) monthToSlot.current.delete(m);
  }

  const used = new Set(monthToSlot.current.values());
  const monthsInOrder = field.map((c) => c.month).filter((m, i, arr) => arr.indexOf(m) === i);
  for (const m of monthsInOrder) {
    if (!monthToSlot.current.has(m)) {
      let slot = 0;
      while (used.has(slot)) slot++;
      monthToSlot.current.set(m, slot);
      used.add(slot);
    }
  }

  const groupSizes = new Map<number, number>();
  for (const c of field) groupSizes.set(c.month, (groupSizes.get(c.month) ?? 0) + 1);

  const monthIndex = new Map<number, number>();
  const result = field.map((card): FieldLayoutItem => {
    const slot = monthToSlot.current.get(card.month)!;
    const idx = monthIndex.get(card.month) ?? 0;
    monthIndex.set(card.month, idx + 1);
    return {
      card,
      slot,
      indexInMonth: idx,
      groupSize: groupSizes.get(card.month) ?? 1,
    };
  });

  useEffect(() => () => monthToSlot.current.clear(), []);
  return result;
}

const CARD_RATIO = 1.63;

export function CenterField({
  field,
  deckCount,
  flippingCardId,
  flippingPhase = null,
  isCompact = false,
}: CenterFieldProps) {
  const layout = useFieldLayout(field);
  // exit 시점의 phase에 맞춰 fade-out duration 조정 — Phase 4에서 layoutId 비행
  // (FLY_DURATION_TO_COLLECTED 2s)과 source motion.div unmount 시간을 맞춰야
  // 매칭 카드가 collected로 비행하는 동안 source가 사라지지 않음.
  const phaseForExit = useAnimationPhase();
  const exitDuration = getLayoutDuration(phaseForExit);

  const [containerRef, { width: cw, height: ch }] = useElementSize<HTMLDivElement>();
  // 첫 mount 시 받은 카드들만 dealing stagger 적용 — 새 카드(더미 뒤집기)는 zero delay
  const [initialFieldIds] = useState(() => new Set(field.map((c) => c.id)));
  const initialFieldTotal = useRef(field.length).current;

  const containerW = cw || 700;
  const containerH = ch || 350;

  /**
   * 좌표 명세:
   *
   * PC (큰 화면): 4 cols × 3 rows 격자 + corner — 6각형 형태 (#1~#10)
   *   Row 0: [corner #7] [mid #1] [mid #2] [corner #8]
   *   Row 1: [side #3]      [더미]         [side #4]
   *   Row 2: [corner #9] [mid #5] [mid #6] [corner #10]
   *
   * 모바일 (compact): 2 rows × 4 cols, 더미는 두 행 사이의 가운데 (정중앙)
   *   Row 0: [#1] [#2]  [#3] [#4]
   *                  [더미]
   *   Row 1: [#5] [#6]  [#7] [#8]
   *
   *   → 더미는 col 2-3, row 0-1 사이의 정중앙 = (0, 0)
   *   → 카드는 col -1.5/-0.5/+0.5/+1.5 × colStep, row ±(rowStep/2 + cardH/2)
   */
  const margin = 16;

  // PC: corner 슬롯 (1.5 × colStep) 이 가장 외곽
  const pcCornerFactorW = 1.5 * (1 + FIELD_HORIZONTAL_GAP_RATIO) + 0.5;
  // PC: mid-side 슬롯 (rowStep 위치)
  const midSideFactorW = (1 + FIELD_VERTICAL_GAP_RATIO) * CARD_RATIO + 0.5;
  // 모바일: 5 col (col -2, -1, 0=더미, +1, +2). 외곽 col = 2 × colStep
  const mobileOuterFactorW = 2 * (1 + FIELD_HORIZONTAL_GAP_RATIO) + 0.5;
  const farFactorW = isCompact
    ? mobileOuterFactorW
    : Math.max(pcCornerFactorW, midSideFactorW);

  // 세로 외곽 factor:
  //   PC: 카드 끝 = (1.5 + VERT_GAP) cardH
  //   모바일: layoutConstants 의 FIELD_MOBILE_FAR_FACTOR_H (cardW heightBased 계산용)
  const farFactorH = isCompact
    ? FIELD_MOBILE_FAR_FACTOR_H
    : 1.5 + FIELD_VERTICAL_GAP_RATIO;

  const cardWByWidth = (containerW / 2 - margin) / farFactorW;
  const cardWByHeight = (containerH / 2 - margin) / (farFactorH * CARD_RATIO);
  const cardCap = isCompact ? FIELD_CARD_MAX_WIDTH.mobile : FIELD_CARD_MAX_WIDTH.pc;
  const cardW = Math.max(
    FIELD_CARD_MIN_WIDTH,
    Math.min(cardCap, cardWByWidth, cardWByHeight),
  );
  const cardH = Math.round(cardW * CARD_RATIO);

  const colStep = cardW * (1 + FIELD_HORIZONTAL_GAP_RATIO); // col 중심 사이 거리
  const rowStep = cardH * (1 + FIELD_VERTICAL_GAP_RATIO); // PC row 중심 사이 거리
  const midSideX = rowStep; // PC: 좌중/우중 ↔ 더미 가로 거리
  // 모바일: row 사이 거리 = cardH × FIELD_MOBILE_ROW_DISTANCE_RATIO
  const mobileRowY = cardH * FIELD_MOBILE_ROW_DISTANCE_RATIO;

  // 슬롯 좌표 — PC는 10 슬롯 (6각형 + corner), 모바일은 8 슬롯 (2행 4열, 가운데 col은 더미 자리)
  //
  // 모바일 배치:
  //   Row 1 (top):    [#1] [#2]   (더미 자리)   [#3] [#4]
  //                                  [더미]
  //   Row 2 (bot):    [#5] [#6]                 [#7] [#8]
  const SLOTS = isCompact
    ? [
        { x: -2 * colStep, y: -mobileRowY }, // 0: row 0, col -2
        { x: -1 * colStep, y: -mobileRowY }, // 1: row 0, col -1
        { x: 1 * colStep, y: -mobileRowY }, // 2: row 0, col +1
        { x: 2 * colStep, y: -mobileRowY }, // 3: row 0, col +2
        { x: -2 * colStep, y: mobileRowY }, // 4: row 1, col -2
        { x: -1 * colStep, y: mobileRowY }, // 5: row 1, col -1
        { x: 1 * colStep, y: mobileRowY }, // 6: row 1, col +1
        { x: 2 * colStep, y: mobileRowY }, // 7: row 1, col +2
      ]
    : [
        { x: -0.5 * colStep, y: -rowStep }, // 0: top-mid-left (#1)
        { x: 0.5 * colStep, y: -rowStep }, // 1: top-mid-right (#2)
        { x: -midSideX, y: 0 }, // 2: mid-left (#3)
        { x: midSideX, y: 0 }, // 3: mid-right (#4)
        { x: -0.5 * colStep, y: rowStep }, // 4: bot-mid-left (#5)
        { x: 0.5 * colStep, y: rowStep }, // 5: bot-mid-right (#6)
        { x: -1.5 * colStep, y: -rowStep }, // 6: top-left corner (#7)
        { x: 1.5 * colStep, y: -rowStep }, // 7: top-right corner (#8)
        { x: -1.5 * colStep, y: rowStep }, // 8: bot-left corner (#9)
        { x: 1.5 * colStep, y: rowStep }, // 9: bot-right corner (#10)
      ];


  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-visible rounded-lg border-2 border-felt-900/50 bg-felt-900/15 shadow-inner"
    >
      {/* 더미 (중앙) — 카드와 동일한 좌상단 기준 좌표 사용 (translate 회피) */}
      <div
        className="absolute z-30"
        style={{
          left: Math.round(containerW / 2 - cardW / 2),
          top: Math.round(containerH / 2 - cardH / 2),
        }}
      >
        <DeckStack count={deckCount} cardW={cardW} cardH={cardH} />
      </div>

      {/* 바닥 카드들 — flippingCardId 카드는 opacity 0으로 가려두고
          별도 floating overlay에서 더미 위치 → 슬롯 위치로 비행 */}
      <AnimatePresence>
        {layout.map(({ card, slot, indexInMonth, groupSize }) => {
          const pos = SLOTS[Math.min(slot, SLOTS.length - 1)] ?? { x: 0, y: 0 };
          const fanOffsetX =
            groupSize > 1 ? indexInMonth * cardW * FIELD_STACK_OFFSET_RATIO : 0;

          const isFlipping = flippingCardId === card.id;
          const left = Math.round(containerW / 2 + pos.x + fanOffsetX - cardW / 2);
          const top = Math.round(containerH / 2 + pos.y - cardH / 2);

          // 부모 motion.div는 transform-free (opacity만) — 자식 Card의 layoutId
          // 비행 보간(transform)을 방해하지 않도록 scale/y 등 transform prop은 제거.
          // 첫 mount 카드(initialFieldIds)만 fade-in stagger 적용. 게임 진행 중 mount는
          // 즉시 opacity 1 — Phase 1-B에서 hand → field 비행 카드가 보이지 않으면
          // 사용자에겐 "순간이동"으로 보이는 버그 회피.
          const initialIdx = initialFieldIds.has(card.id)
            ? Array.from(initialFieldIds).indexOf(card.id)
            : -1;
          const isInitialDeal = initialIdx >= 0;
          const dealDelay = isInitialDeal ? fieldDealDelay(initialIdx, initialFieldTotal) : 0;
          return (
            <motion.div
              key={card.id}
              // 새로 mount되는 카드는 무조건 opacity 0 시작 — Phase 3 시작 시
              // (setDisplayView/setFlippingCardId batch race로) drawnCard가 한 frame
              //  opacity 1로 보이는 잔상 방지.
              // animate에서 isFlipping 검사 — true면 그대로 0 유지 (floating overlay 담당),
              // false면 0→1 fade-in.
              // exit transition은 phase별 layoutDuration과 동기화 — Phase 4 collected
              // 비행 시 source motion.div가 너무 빨리 unmount되어 카드가 갑자기
              // 사라지는 문제 방지.
              initial={{ opacity: 0 }}
              animate={{ opacity: isFlipping ? 0 : 1 }}
              exit={{ opacity: 0, transition: { duration: exitDuration } }}
              transition={{ duration: 0.2, delay: dealDelay }}
              className="absolute"
              style={{
                left,
                top,
                zIndex: 10 + indexInMonth,
              }}
            >
              <Card card={card} width={cardW} layoutId={card.id} />
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Phase 3 floating overlay — 더미 위치에서 flip + 확대 → 슬롯으로 비행 */}
      {(() => {
        const flippingItem = flippingCardId
          ? layout.find((item) => item.card.id === flippingCardId)
          : null;
        if (!flippingItem) return null;
        const slotPos = SLOTS[Math.min(flippingItem.slot, SLOTS.length - 1)] ?? {
          x: 0,
          y: 0,
        };
        const fanOffsetX =
          flippingItem.groupSize > 1
            ? flippingItem.indexInMonth * cardW * FIELD_STACK_OFFSET_RATIO
            : 0;
        const targetLeft = Math.round(
          containerW / 2 + slotPos.x + fanOffsetX - cardW / 2,
        );
        const targetTop = Math.round(containerH / 2 + slotPos.y - cardH / 2);
        const deckLeft = Math.round(containerW / 2 - cardW / 2);
        const deckTop = Math.round(containerH / 2 - cardH / 2);

        // sub-phase별 animate target + duration. step 모드에서 sub-phase 단위 click과 동기화.
        //   flip: deck 위치 유지, rotateY 180 → 0, scale 1
        //   peak: deck 위치 유지, rotateY 0, scale 1 → FLIP_PEAK_SCALE
        //   fly:  deck → slot, rotateY 0, scale FLIP_PEAK_SCALE → 1
        const animateTarget =
          flippingPhase === 'flip'
            ? { left: deckLeft, top: deckTop, rotateY: 0, scale: 1 }
            : flippingPhase === 'peak'
              ? { left: deckLeft, top: deckTop, rotateY: 0, scale: FLIP_PEAK_SCALE }
              : flippingPhase === 'fly'
                ? { left: targetLeft, top: targetTop, rotateY: 0, scale: 1 }
                : { left: deckLeft, top: deckTop, rotateY: 180, scale: 1 };

        const transitionDuration =
          flippingPhase === 'flip'
            ? applySpeed(FLIP_DURATION)
            : flippingPhase === 'peak'
              ? applySpeed(SCALE_PEAK_DURATION)
              : flippingPhase === 'fly'
                ? applySpeed(FLY_TO_SLOT_DURATION)
                : 0;

        return (
          <motion.div
            key={`flipping-${flippingItem.card.id}`}
            initial={{
              left: deckLeft,
              top: deckTop,
              rotateY: 180,
              scale: 1,
              opacity: 1,
            }}
            animate={animateTarget}
            transition={{
              duration: transitionDuration,
              ease: 'easeInOut',
            }}
            className="absolute"
            style={{
              width: cardW,
              height: cardH,
              zIndex: 60,
              transformStyle: 'preserve-3d',
            }}
          >
            {/* 앞면 — rotateY 0일 때 정면. backface hidden이라 180일 때 안 보임. */}
            <div
              className="absolute inset-0"
              style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
            >
              <Card card={flippingItem.card} width={cardW} />
            </div>
            {/* 뒷면 (카드백) — 부모 rotateY 180일 때 정면 (자식 rotateY 180으로 상쇄). */}
            <div
              className="absolute inset-0"
              style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
              }}
            >
              <div
                className="bg-card-back rounded-md ring-1 ring-amber-300/30 shadow-lg"
                style={{ width: cardW, height: cardH }}
              />
            </div>
          </motion.div>
        );
      })()}

      {field.length === 0 && (
        <div className="absolute left-1/2 top-1/2 z-0 -translate-x-1/2 translate-y-20 text-xs italic text-felt-300/50">
          바닥 비어있음
        </div>
      )}
    </div>
  );
}

function DeckStack({ count, cardW, cardH }: { count: number; cardW: number; cardH: number }) {
  return (
    <div className="relative">
      <div
        className="bg-card-back rounded-md ring-1 ring-amber-300/30 shadow-lg"
        style={{ width: cardW, height: cardH }}
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none"
        style={{ fontSize: Math.max(20, cardW * 0.4) }}
      >
        <AnimatedNumber
          value={count}
          stiffness={100}
          damping={25}
          className="font-black text-amber-200 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]"
        />
      </div>
    </div>
  );
}
