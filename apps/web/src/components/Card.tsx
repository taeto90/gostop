import type { Card as CardType } from '@gostop/shared';
import { motion } from 'framer-motion';
import { getLayoutDuration, useAnimationPhase } from '../lib/animationContext.ts';
import { applySpeed, HAND_PEAK_DURATION, HAND_PEAK_SCALE } from '../lib/animationTiming.ts';

interface CardProps {
  card?: CardType;
  faceDown?: boolean;
  highlight?: 'matchable' | 'selected' | 'matched' | 'trigger' | 'none';
  onClick?: () => void;
  /** 사이즈 프리셋 */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** 커스텀 너비 (size 무시). 높이는 자동 (1.5배). */
  width?: number;
  /** Framer Motion shared layout 애니메이션용 */
  layoutId?: string;
  /** 라벨 (스크린리더 + 디버그) */
  label?: string;
  /** Phase 1-A: 손패 카드를 그 자리에서 확대 (HAND_PEAK_SCALE 배) */
  peakScale?: boolean;
}

/** 원본 화투 SVG 비율 (height/width). Wikimedia Hwatu SVG는 103.2 × 168.2 = 1.63. */
const CARD_RATIO = 1.63;

type SizePreset = 'xs' | 'sm' | 'md' | 'lg';
type Highlight = NonNullable<CardProps['highlight']>;

const SIZE_DIM: Record<SizePreset, { w: number; h: number }> = {
  xs: { w: 32, h: Math.round(32 * CARD_RATIO) },
  sm: { w: 48, h: Math.round(48 * CARD_RATIO) },
  md: { w: 56, h: Math.round(56 * CARD_RATIO) },
  lg: { w: 80, h: Math.round(80 * CARD_RATIO) },
};

/** highlight 타입별 ring/glow 클래스. 한 곳에서 톤 조절. */
const HIGHLIGHT_CLASS: Record<Highlight, string> = {
  matchable:
    'ring-[5px] ring-amber-400/70 ring-offset-2 ring-offset-felt-950 animate-matchable shadow-[0_0_16px_5px_rgba(252,211,77,0.5)] -translate-y-1.5 brightness-110 saturate-150',
  selected: 'ring-2 ring-sky-400',
  matched: 'ring-2 ring-emerald-400',
  trigger:
    'ring-[8px] ring-rose-400 ring-offset-2 ring-offset-felt-900 animate-pulse shadow-[0_0_28px_rgba(251,113,133,0.95)]',
  none: '',
};

function getDim(size: SizePreset, width?: number) {
  if (width && width > 0) {
    return { w: width, h: Math.round(width * CARD_RATIO) };
  }
  return SIZE_DIM[size];
}

export function Card({
  card,
  faceDown,
  highlight = 'none',
  onClick,
  size = 'md',
  width,
  layoutId,
  label,
  peakScale = false,
}: CardProps) {
  const dim = getDim(size, width);
  const fontSize = Math.max(8, Math.round(dim.w / 7));

  if (faceDown || !card) {
    return (
      <motion.div
        layoutId={layoutId}
        className="bg-card-back flex-shrink-0 rounded-md"
        style={{ width: dim.w, height: dim.h }}
        aria-label={label ?? '카드 뒷면'}
      />
    );
  }

  // 특수 카드 (조커 / 폭탄) — SVG 없이 그라데이션 + 이모지/라벨로 렌더
  if (card.isJoker) {
    return (
      <SpecialCard
        layoutId={layoutId}
        onClick={onClick}
        peakScale={peakScale}
        highlight={highlight}
        dim={dim}
        fontSize={fontSize}
        emoji="🃏"
        ariaLabel={label ?? '🃏 조커 카드'}
        title="조커 카드 — 쌍피 가치, 매칭 X"
        bgClass="border-purple-900 bg-gradient-to-br from-purple-500 via-fuchsia-600 to-purple-800"
        cornerBadge={{ text: '쌍피', bgClass: 'bg-rose-500/90' }}
      />
    );
  }
  if (card.isBomb) {
    return (
      <SpecialCard
        layoutId={layoutId}
        onClick={onClick}
        peakScale={peakScale}
        highlight={highlight}
        dim={dim}
        fontSize={fontSize}
        emoji="💣"
        bottomLabel="폭탄"
        ariaLabel={label ?? '💣 폭탄 카드'}
        title="폭탄 카드 — 클릭 시 손패에서 제거되고 더미 1장만 뒤집힙니다"
        bgClass="border-rose-900 bg-gradient-to-br from-rose-600 via-rose-700 to-rose-900"
      />
    );
  }

  const imgUrl = `/assets/cards/${card.id}.svg`;
  const ringClass = HIGHLIGHT_CLASS[highlight];

  const Component = onClick ? motion.button : motion.div;
  const phase = useAnimationPhase();
  const layoutDuration = getLayoutDuration(phase);

  return (
    <Component
      layoutId={layoutId}
      layout="position"
      onClick={onClick}
      whileHover={onClick && !peakScale ? { y: -4 } : undefined}
      animate={{ scale: peakScale ? HAND_PEAK_SCALE : 1 }}
      transition={{
        layout: { duration: layoutDuration, ease: 'easeInOut' },
        scale: { duration: applySpeed(HAND_PEAK_DURATION), ease: 'easeOut' },
        // default를 layoutDuration으로 명시 — framer-motion 12에서 transition.layout이
        // default spring에 override되는 케이스 방지. hover 같은 동작은 whileHover에서 처리.
        default: { duration: layoutDuration, ease: 'easeInOut' },
      }}
      className={`${ringClass} ${
        onClick ? 'cursor-pointer' : ''
      } relative flex-shrink-0 overflow-hidden rounded-md border-2 border-stone-900 bg-white shadow-md`}
      style={{ width: dim.w, height: dim.h, fontSize, zIndex: peakScale ? 60 : undefined }}
      aria-label={label ?? card.name}
      title={card.name}
    >
      <img
        src={imgUrl}
        alt={card.name}
        className="h-full w-full"
        draggable={false}
        loading="lazy"
      />
      {(card.isGoDori || card.isSsangPi || card.isBigwang) && (
        <div className="absolute right-0.5 top-0.5 flex flex-col gap-0.5">
          {card.isGoDori && (
            <span
              className="rounded bg-sky-500/90 font-bold text-white shadow"
              style={{ paddingInline: 3, paddingBlock: 1, fontSize: Math.max(7, fontSize - 3) }}
            >
              고
            </span>
          )}
          {card.isSsangPi && (
            <span
              className="rounded bg-rose-500/90 font-bold text-white shadow"
              style={{ paddingInline: 3, paddingBlock: 1, fontSize: Math.max(7, fontSize - 3) }}
            >
              쌍피
            </span>
          )}
          {card.isBigwang && (
            <span
              className="rounded bg-amber-500/90 font-bold text-stone-900 shadow"
              style={{ paddingInline: 3, paddingBlock: 1, fontSize: Math.max(7, fontSize - 3) }}
            >
              비
            </span>
          )}
        </div>
      )}
    </Component>
  );
}

interface SpecialCardProps {
  layoutId?: string;
  onClick?: () => void;
  peakScale: boolean;
  highlight: Highlight;
  dim: { w: number; h: number };
  fontSize: number;
  emoji: string;
  bottomLabel?: string;
  ariaLabel: string;
  title: string;
  bgClass: string;
  cornerBadge?: { text: string; bgClass: string };
}

/** 폭탄/조커 — SVG 없이 그라데이션 + 이모지/라벨로 렌더하는 공통 컴포넌트. */
function SpecialCard({
  layoutId,
  onClick,
  peakScale,
  highlight,
  dim,
  fontSize,
  emoji,
  bottomLabel,
  ariaLabel,
  title,
  bgClass,
  cornerBadge,
}: SpecialCardProps) {
  const Component = onClick ? motion.button : motion.div;
  const ringClass = HIGHLIGHT_CLASS[highlight];
  return (
    <Component
      layoutId={layoutId}
      layout="position"
      onClick={onClick}
      whileHover={onClick && !peakScale ? { y: -4 } : undefined}
      animate={{ scale: peakScale ? HAND_PEAK_SCALE : 1 }}
      transition={{
        scale: { duration: applySpeed(HAND_PEAK_DURATION), ease: 'easeOut' },
        default: { type: 'spring', stiffness: 200, damping: 25 },
      }}
      className={`${ringClass} ${onClick ? 'cursor-pointer' : ''} relative flex flex-shrink-0 flex-col items-center justify-center overflow-hidden rounded-md border-2 shadow-md ${bgClass}`}
      style={{ width: dim.w, height: dim.h, fontSize, zIndex: peakScale ? 60 : undefined }}
      aria-label={ariaLabel}
      title={title}
    >
      <span style={{ fontSize: Math.round(dim.w * 0.55), lineHeight: 1 }}>{emoji}</span>
      {bottomLabel && (
        <span className="mt-1 font-extrabold text-rose-50 drop-shadow" style={{ fontSize: Math.max(7, fontSize - 1) }}>
          {bottomLabel}
        </span>
      )}
      {cornerBadge && (
        <span
          className={`absolute right-0.5 top-0.5 rounded font-bold text-white shadow ${cornerBadge.bgClass}`}
          style={{ paddingInline: 3, paddingBlock: 1, fontSize: Math.max(7, fontSize - 3) }}
        >
          {cornerBadge.text}
        </span>
      )}
    </Component>
  );
}

