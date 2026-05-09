import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface GoStopModalProps {
  open: boolean;
  score: number;
  goCount: number;
  /** 자동 카운트다운 (초). 0이면 비활성 */
  autoCountdownSeconds?: number;
  onGo: () => void;
  onStop: () => void;
}

/**
 * 7점 도달 시 표시되는 고/스톱 결정 모달.
 *
 * - 1고 = 점수 ×1 + 다음 점수 추가
 * - 2고 = 점수 ×2
 * - 3고 = 점수 ×3
 * - 스톱 = 현재 점수 확정 게임 종료
 *
 * Phase 4의 핵심 UI. 추가 로직 (고박, 점수 누적)은 서버 측에서 처리.
 */
export function GoStopModal({
  open,
  score,
  goCount,
  autoCountdownSeconds = 0,
  onGo,
  onStop,
}: GoStopModalProps) {
  const [remaining, setRemaining] = useState(autoCountdownSeconds);

  useEffect(() => {
    if (!open || autoCountdownSeconds <= 0) return;
    setRemaining(autoCountdownSeconds);
    const interval = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(interval);
          onStop(); // 무응답 시 STOP (안전하게 점수 확정)
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [open, autoCountdownSeconds, onStop]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.7, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.7, y: 20 }}
            transition={{ type: 'spring', stiffness: 200, damping: 22 }}
            className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl border-2 border-amber-400/60 bg-gradient-to-b from-felt-800 to-felt-950 p-5 shadow-2xl sm:p-8"
          >
            <div className="mb-3 text-center">
              <div className="text-sm font-semibold text-amber-300">7점 도달!</div>
              <div className="text-5xl font-black text-amber-200">
                {score}점
              </div>
              {goCount > 0 && (
                <div className="mt-1 text-sm text-rose-300">
                  현재 {goCount}고 진행 중 — 다시 고하면 ×{goCount + 1}배
                </div>
              )}
            </div>

            <div className="mb-4 text-center text-sm text-felt-200">
              지금 멈추고 점수를 확정할까요? 아니면 계속 가서 더 큰 점수를 노릴까요?
            </div>

            <div className="grid grid-cols-2 gap-3">
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={onGo}
                className="rounded-lg bg-rose-500 px-4 py-4 text-2xl font-black text-white shadow-lg shadow-rose-900/50 hover:bg-rose-400"
              >
                🔥 GO!
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={onStop}
                className="rounded-lg bg-emerald-500 px-4 py-4 text-2xl font-black text-white shadow-lg shadow-emerald-900/50 hover:bg-emerald-400"
              >
                🛑 STOP
              </motion.button>
            </div>

            {autoCountdownSeconds > 0 && (
              <div className="mt-3 text-center text-xs text-felt-300">
                {remaining}초 후 자동 STOP
              </div>
            )}

            <div className="mt-3 rounded bg-felt-950/50 p-2 text-[10px] text-felt-300">
              <div className="font-bold text-felt-200">고/스톱 룰</div>
              <ul className="mt-0.5 list-disc pl-4">
                <li>고: 점수 누적 + 다음 점수마다 ×N배</li>
                <li>스톱: 현재 점수 확정 → 게임 종료</li>
                <li>고 후 점수 못 내면 "고박" — 상대 점수 ×2</li>
              </ul>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
