import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { AiDifficulty } from '@gostop/shared';
import {
  MODAL_SCALE_ANIMATE,
  MODAL_SCALE_EXIT,
  MODAL_SCALE_INITIAL,
  MODAL_SPRING,
} from '../../lib/animationTiming.ts';

interface AISetupModalProps {
  open: boolean;
  /** 현재 player 수 (1 또는 2). 봇 인원 슬롯 수가 결정됨 (1명 → 1~2 / 2명 → 1) */
  playerCount: number;
  onClose: () => void;
  onConfirm: (botDifficulties: AiDifficulty[]) => void;
}

const DIFFICULTY_LABEL: Record<AiDifficulty, string> = {
  easy: '😴 쉬움',
  medium: '🤔 보통',
  hard: '😈 어려움',
};

const DIFFICULTY_DESC: Record<AiDifficulty, string> = {
  easy: '거의 무작위',
  medium: '간단한 매칭/피 우선',
  hard: '점수/상대 견제 고려',
};

/**
 * 호스트가 게임 시작 시 player가 1~2명일 때 AI 봇 인원 + 봇별 개별 난이도 선택.
 * 확인 → game:start emit (botDifficulties 포함). 취소 → 닫기 (게임 시작 X).
 */
export function AISetupModal({
  open,
  playerCount,
  onClose,
  onConfirm,
}: AISetupModalProps) {
  // 1명일 때 default 1봇 (1:1), 2명일 때 default 1봇 (3인). max = 5 - player.
  const maxBots = Math.max(1, Math.min(2, 5 - playerCount));
  const [count, setCount] = useState(1);
  const [difficulties, setDifficulties] = useState<AiDifficulty[]>([
    'medium',
    'medium',
  ]);

  // 모달 열릴 때마다 default 1봇으로 reset
  useEffect(() => {
    if (open) {
      setCount(1);
      setDifficulties(['medium', 'medium']);
    }
  }, [open]);

  // ESC 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  function setDifficulty(idx: number, d: AiDifficulty) {
    setDifficulties((prev) => {
      const next = [...prev];
      next[idx] = d;
      return next;
    });
  }

  function handleConfirm() {
    onConfirm(difficulties.slice(0, count));
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={MODAL_SCALE_INITIAL}
            animate={MODAL_SCALE_ANIMATE}
            exit={MODAL_SCALE_EXIT}
            transition={MODAL_SPRING}
            className="w-full max-w-md rounded-2xl border-2 border-amber-400/50 bg-felt-900 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 text-center">
              <div className="text-2xl">🤖</div>
              <h2 className="mt-1 text-lg font-bold text-felt-100">AI 봇 설정</h2>
              <p className="mt-1 text-xs text-felt-400">
                플레이어가 {playerCount}명이라 AI 봇과 함께 진행합니다
              </p>
            </div>

            {/* 봇 인원 선택 — maxBots > 1일 때만 */}
            {maxBots > 1 && (
              <div className="mb-4">
                <div className="mb-2 text-xs font-semibold text-felt-300">
                  봇 인원
                </div>
                <div className="flex gap-2">
                  {Array.from({ length: maxBots }).map((_, i) => {
                    const n = i + 1;
                    return (
                      <button
                        key={n}
                        onClick={() => setCount(n)}
                        className={`flex-1 rounded-lg border-2 px-3 py-2 text-sm font-bold transition ${
                          count === n
                            ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                            : 'border-felt-800 bg-felt-950/40 text-felt-400 hover:border-felt-700'
                        }`}
                      >
                        {n}명
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 봇별 난이도 */}
            <div className="space-y-3">
              {Array.from({ length: count }).map((_, i) => (
                <div key={i}>
                  <div className="mb-1.5 text-xs font-semibold text-felt-300">
                    봇 {i + 1} 난이도
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['easy', 'medium', 'hard'] as const).map((d) => {
                      const active = difficulties[i] === d;
                      return (
                        <button
                          key={d}
                          onClick={() => setDifficulty(i, d)}
                          title={DIFFICULTY_DESC[d]}
                          className={`rounded-lg border px-2 py-2 text-xs font-bold transition ${
                            active
                              ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                              : 'border-felt-800 bg-felt-950/40 text-felt-400 hover:border-felt-700'
                          }`}
                        >
                          {DIFFICULTY_LABEL[d]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* 버튼 */}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={onClose}
                className="rounded bg-felt-800 px-4 py-2 text-sm font-semibold text-felt-200 hover:bg-felt-700"
              >
                취소
              </button>
              <button
                onClick={handleConfirm}
                className="rounded bg-amber-500 px-5 py-2 text-sm font-bold text-slate-950 hover:bg-amber-400"
              >
                🤖 봇 추가
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
