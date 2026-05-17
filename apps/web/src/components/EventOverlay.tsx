import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { type GameEvent, useEventOverlayStore } from '../stores/eventOverlayStore.ts';
import { playSound, type SoundName } from '../lib/sound.ts';
import { applySpeed } from '../lib/animationTiming.ts';

/**
 * 이벤트 → 사운드 매핑. 새 사운드 파일 추가 시 여기에 등록.
 * 현재는 기존 사운드 자산만 사용 (boom / card-place / score-up / game-end / emoji-react).
 */
// 폭탄/흔들기 사운드는 EventOverlay에서 발화 X — useMultiTurnSequence의 Phase 1-B 끝 시점에
// 직접 'boom' 사운드 재생 (rules-final.md §4 — 폭탄 발동 = 3장 한 번에 placed 시점).
const EVENT_SOUND_MAP: Partial<Record<GameEvent, SoundName>> = {
  ppeok: 'card-place',
  'first-ppeok': 'score-up',
  'ja-ppeok': 'score-up',
  ttadak: 'score-up',
  jjok: 'score-up',
  sweep: 'score-up',
  chongtong: 'game-end',
  go: 'score-up',
  stop: 'score-up',
  myungttadak: 'score-up',
  nagari: 'game-end',
  shodang: 'emoji-react',
};

/** 이벤트별 emoji + 라벨 + 색상 톤. */
interface EventMeta {
  emoji: string;
  label: string;
  /** Tailwind text 색상 — `text-${color}-300` 형태로 사용 */
  color: string;
  /** 추가 효과 — 카드 흔들림 등 (옵션) */
  shake?: boolean;
}

const EVENT_META: Record<GameEvent, EventMeta> = {
  ppeok: { emoji: '🚫', label: '뻑!', color: 'rose' },
  'first-ppeok': { emoji: '⭐', label: '첫뻑!', color: 'amber' },
  'ja-ppeok': { emoji: '💥', label: '자뻑!', color: 'amber' },
  ttadak: { emoji: '✨', label: '따닥!', color: 'cyan' },
  jjok: { emoji: '💋', label: '쪽!', color: 'pink' },
  sweep: { emoji: '🧹', label: '싹쓸이!', color: 'purple' },
  bomb: { emoji: '💣', label: '폭탄!', color: 'orange', shake: true },
  shake: { emoji: '🤲', label: '흔들기!', color: 'orange', shake: true },
  chongtong: { emoji: '👑', label: '총통!', color: 'amber' },
  go: { emoji: '✊', label: 'GO!', color: 'rose' },
  stop: { emoji: '🛑', label: 'STOP!', color: 'sky' },
  bak: { emoji: '💢', label: '박!', color: 'rose' },
  myungttadak: { emoji: '🐦', label: '멍따!', color: 'cyan' },
  nagari: { emoji: '🤝', label: '나가리...', color: 'slate' },
  shodang: { emoji: '🚫', label: '쇼당!', color: 'amber', shake: true },
};

/** Tailwind 안전 — class string에 Pre-defined 매핑 (JIT가 인식하도록) */
const COLOR_CLASS: Record<string, string> = {
  rose: 'text-rose-300 drop-shadow-[0_0_24px_rgba(251,113,133,0.7)]',
  amber: 'text-amber-300 drop-shadow-[0_0_24px_rgba(251,191,36,0.7)]',
  cyan: 'text-cyan-300 drop-shadow-[0_0_24px_rgba(103,232,249,0.7)]',
  pink: 'text-pink-300 drop-shadow-[0_0_24px_rgba(244,114,182,0.7)]',
  purple: 'text-purple-300 drop-shadow-[0_0_24px_rgba(192,132,252,0.7)]',
  orange: 'text-orange-300 drop-shadow-[0_0_24px_rgba(253,186,116,0.7)]',
  sky: 'text-sky-300 drop-shadow-[0_0_24px_rgba(125,211,252,0.7)]',
  slate: 'text-slate-300 drop-shadow-[0_0_18px_rgba(148,163,184,0.5)]',
};

const HIDE_DURATION_MS = 2200;

/**
 * 게임 중 특수 이벤트(뻑/자뻑/따닥/쪽/싹쓸이/폭탄/흔들기/총통/고/스톱/박/멍따/나가리)
 * 발생 시 화면 가운데에 큰 텍스트로 잠깐 표시.
 *
 * `useEventOverlayStore`의 `trigger`를 호출하면 발화. 1.1초 후 자동 사라짐.
 * 사운드는 추후 `lib/sound.ts`에서 매핑.
 */
export function EventOverlay() {
  const event = useEventOverlayStore((s) => s.current);
  const clear = useEventOverlayStore((s) => s.clear);

  useEffect(() => {
    if (!event) return;
    const sound = EVENT_SOUND_MAP[event];
    if (sound) playSound(sound);
    const timer = setTimeout(clear, applySpeed(HIDE_DURATION_MS / 1000) * 1000);
    return () => clearTimeout(timer);
  }, [event, clear]);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center"
      aria-live="polite"
    >
      <AnimatePresence mode="wait">
        {event && (
          <motion.div
            key={event}
            initial={{ scale: 0.4, opacity: 0, y: 20 }}
            animate={
              EVENT_META[event].shake
                ? { scale: 1, opacity: 1, y: 0, x: [0, -8, 8, -6, 6, 0] }
                : { scale: 1, opacity: 1, y: 0 }
            }
            exit={{ scale: 1.4, opacity: 0, y: -10 }}
            transition={{
              type: 'spring',
              stiffness: 220,
              damping: 18,
              x: { duration: 0.4, ease: 'easeOut' },
            }}
            className="flex flex-col items-center gap-2 select-none"
          >
            <motion.span
              initial={{ scale: 0.5 }}
              animate={{ scale: [0.5, 1.3, 1] }}
              transition={{ duration: 0.5, times: [0, 0.6, 1] }}
              className="text-7xl drop-shadow-[0_4px_16px_rgba(0,0,0,0.6)]"
            >
              {EVENT_META[event].emoji}
            </motion.span>
            <span
              className={`text-5xl font-black tracking-wider ${
                COLOR_CLASS[EVENT_META[event].color] ?? COLOR_CLASS.slate
              }`}
            >
              {EVENT_META[event].label}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
