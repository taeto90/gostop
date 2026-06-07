import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { playSound } from '../lib/sound.ts';
import { emitWithAck } from '../lib/socket.ts';
import { subscribeReaction } from '../hooks/useRoomSocket.ts';

const REACTIONS = ['😂', '😎', '🥳', '😱', '🔥', '💀', '👏', '🤡'] as const;

interface FloatingEmoji {
  id: number;
  emoji: string;
  startX: number; // % 가로 위치
}

let nextId = 1;

// 모듈 레벨 버스 — 피커(어디든)에서 발사한 이모지를 FloatLayer로 전달.
// FloatLayer는 GameView에 1개 mount. 피커는 PC: 사이드바 채팅 / 모바일: 채팅 모달 헤더.
let floatBus: ((emoji: string) => void) | null = null;

/** 본인 이모지 발사 — 사운드 + 로컬 float + socket broadcast (본인 제외 수신) */
export function useEmojiSend(): (emoji: string) => void {
  return useCallback((emoji: string) => {
    playSound('emoji-react');
    floatBus?.(emoji);
    void emitWithAck('reaction:send', { emoji });
  }, []);
}

/**
 * 떠오르는 이모지 효과 레이어 + socket 수신.
 * 게임 화면에 항상 1개 mount (피커와 분리 — 2026-06 PC 개편).
 */
export function EmojiFloatLayer({ containerClassName }: { containerClassName?: string }) {
  const [floating, setFloating] = useState<FloatingEmoji[]>([]);

  const pushFloating = useCallback((emoji: string) => {
    const id = nextId++;
    const startX = 60 + Math.random() * 30;
    setFloating((prev) => [...prev, { id, emoji, startX }]);
    setTimeout(() => {
      setFloating((prev) => prev.filter((f) => f.id !== id));
    }, 2200);
  }, []);

  // 본인 발사 (피커 → 모듈 버스) 등록
  useEffect(() => {
    floatBus = pushFloating;
    return () => {
      if (floatBus === pushFloating) floatBus = null;
    };
  }, [pushFloating]);

  // 다른 사용자의 이모지 수신
  useEffect(() => {
    const unsub = subscribeReaction(({ emoji }) => {
      pushFloating(emoji);
      playSound('emoji-react');
    });
    return unsub;
  }, [pushFloating]);

  return (
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
  );
}

/**
 * 이모지 피커 버튼 — 채팅 헤더/입력란 옆 등 임의 위치에 배치 (PC 우측 사이드바용).
 * 클릭 시 popover에서 이모지 선택 → 발사. direction으로 펼침 방향 지정
 * (overflow-hidden 컨테이너 안에서는 잘리지 않는 방향으로).
 */
export function EmojiPickerButton({
  className,
  direction = 'up',
}: {
  className?: string;
  direction?: 'up' | 'down';
}) {
  const [open, setOpen] = useState(false);
  const send = useEmojiSend();
  const wrapRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 / ESC로 닫기
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className={`relative ${className ?? ''}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded border border-felt-700 bg-felt-950 text-lg transition hover:bg-felt-800"
        aria-label="이모지 반응"
        title="이모지 반응"
      >
        😊
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: direction === 'up' ? 6 : -6, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: direction === 'up' ? 6 : -6, scale: 0.92 }}
            transition={{ duration: 0.12 }}
            className={`absolute right-0 z-50 grid grid-cols-4 gap-1.5 rounded-xl border-2 border-amber-400/50 bg-felt-900 p-2 shadow-2xl ${
              direction === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'
            }`}
          >
            {REACTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  send(emoji);
                  setOpen(false);
                }}
                className="flex h-11 w-11 items-center justify-center rounded-lg bg-felt-950/60 text-2xl transition hover:scale-110 hover:bg-felt-800 active:scale-95"
                aria-label={`${emoji} 반응`}
              >
                {emoji}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
