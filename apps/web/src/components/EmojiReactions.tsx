import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { playSound } from '../lib/sound.ts';
import { emitWithAck } from '../lib/socket.ts';
import { subscribeReaction } from '../hooks/useRoomSocket.ts';

const REACTIONS = ['😂', '😎', '🥳', '😱', '🔥', '💀', '👏', '🤡'] as const;
type Reaction = (typeof REACTIONS)[number];

interface FloatingEmoji {
  id: number;
  emoji: Reaction;
  startX: number; // % 가로 위치
}

let nextId = 1;

interface EmojiReactionsProps {
  /** 토스트 띄울 컨테이너 — 기본은 fullscreen */
  containerClassName?: string;
}

/**
 * 게임 화면에 이모지 반응을 띄울 수 있는 컴포넌트.
 *
 * - 우측 끝 토글 버튼 → 클릭 시 모달 형태로 이모지 그리드 펼침
 * - 이모지 클릭 → 화면 위로 떠오르는 효과 + 모달 닫힘
 * - socket으로 모든 멤버에게 broadcast
 */
export function EmojiReactions({ containerClassName }: EmojiReactionsProps) {
  const [floating, setFloating] = useState<FloatingEmoji[]>([]);
  const [open, setOpen] = useState(false);

  function pushFloating(emoji: string) {
    const id = nextId++;
    const startX = 60 + Math.random() * 30;
    setFloating((prev) => [...prev, { id, emoji: emoji as Reaction, startX }]);
    setTimeout(() => {
      setFloating((prev) => prev.filter((f) => f.id !== id));
    }, 2200);
  }

  const react = useCallback((emoji: Reaction) => {
    playSound('emoji-react');
    pushFloating(emoji);
    void emitWithAck('reaction:send', { emoji });
    setOpen(false);
  }, []);

  // 다른 사용자의 이모지 수신
  useEffect(() => {
    const unsub = subscribeReaction(({ emoji }) => {
      pushFloating(emoji);
      playSound('emoji-react');
    });
    return unsub;
  }, []);

  // ESC로 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      {/* 떠오르는 이모지들 */}
      <div
        className={`pointer-events-none fixed inset-0 z-40 ${containerClassName ?? ''}`}
        aria-hidden
      >
        <AnimatePresence>
          {floating.map((f) => (
            <motion.div
              key={f.id}
              initial={{ y: 0, opacity: 1, scale: 0.6 }}
              animate={{ y: -160, opacity: 0, scale: 1.4, rotate: (Math.random() - 0.5) * 20 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="absolute bottom-20 select-none text-5xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
              style={{ left: `${f.startX}%` }}
            >
              {f.emoji}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* 토글 버튼 (우측 끝, 손패 위) */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="pointer-events-auto fixed right-3 top-1/2 z-30 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-felt-700/60 bg-felt-950/90 text-xl shadow-lg backdrop-blur-sm transition hover:scale-110 hover:bg-felt-900 active:scale-95"
        aria-label="이모지 반응"
        title="이모지 반응"
      >
        😀
      </button>

      {/* 이모지 선택 모달 */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.85, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.85, y: 10 }}
              transition={{ type: 'spring', stiffness: 220, damping: 22 }}
              className="rounded-2xl border-2 border-amber-400/50 bg-felt-900 p-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-2 text-center text-sm font-bold text-felt-200">
                이모지 반응
              </div>
              <div className="grid grid-cols-4 gap-2">
                {REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => react(emoji)}
                    className="flex h-12 w-12 items-center justify-center rounded-lg bg-felt-950/60 text-2xl transition hover:scale-110 hover:bg-felt-800 active:scale-95"
                    aria-label={`${emoji} 반응`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
