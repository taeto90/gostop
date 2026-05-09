import { motion, AnimatePresence } from 'framer-motion';
import type { Card as CardType } from '@gostop/shared';
import { Card } from '../../../components/Card.tsx';

export interface ShakeBombDetection {
  /** 같은 월 3장 보유 */
  shakeMonths: { month: number; cards: CardType[] }[];
  /** 같은 월 4장 보유 */
  bombMonths: { month: number; cards: CardType[] }[];
}

interface ShakeBombModalProps {
  open: boolean;
  detection: ShakeBombDetection;
  onApply: (apply: { shakeMonths: number[]; bombMonths: number[] }) => void;
  onSkip: () => void;
}

/**
 * 게임 시작 시 손패에 같은 월 3장(흔들기) 또는 4장(폭탄)이 있으면
 * 사용자에게 적용 여부 확인하는 모달.
 */
export function ShakeBombModal({ open, detection, onApply, onSkip }: ShakeBombModalProps) {
  const hasAny = detection.shakeMonths.length > 0 || detection.bombMonths.length > 0;

  return (
    <AnimatePresence>
      {open && hasAny && (
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
            className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl border-2 border-amber-400/60 bg-gradient-to-b from-felt-800 to-felt-950 p-4 shadow-2xl sm:p-6"
          >
            <div className="mb-3 text-center">
              <div className="text-xs font-semibold text-amber-300">기회 발견!</div>
              <div className="text-2xl font-black text-amber-200">
                💪 흔들기 / 💣 폭탄
              </div>
            </div>

            <p className="mb-4 text-center text-sm text-felt-200">
              손패에 같은 월 카드를 다수 보유 중입니다. 적용하면 점수가 ×2배 됩니다.
            </p>

            {/* 흔들기 후보 */}
            {detection.shakeMonths.length > 0 && (
              <section className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                <div className="mb-2 text-xs font-bold text-amber-300">
                  💪 흔들기 가능 ({detection.shakeMonths.length}개월)
                </div>
                <div className="flex flex-wrap gap-3">
                  {detection.shakeMonths.map((g) => (
                    <div key={g.month} className="flex flex-col items-center gap-1">
                      <div className="text-[10px] text-amber-200">{g.month}월</div>
                      <div className="flex -space-x-2">
                        {g.cards.map((c) => (
                          <Card key={c.id} card={c} width={36} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 폭탄 후보 */}
            {detection.bombMonths.length > 0 && (
              <section className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3">
                <div className="mb-2 text-xs font-bold text-rose-300">
                  💣 폭탄 가능 ({detection.bombMonths.length}개월) — ×2배 + 상대 피 1장
                </div>
                <div className="flex flex-wrap gap-3">
                  {detection.bombMonths.map((g) => (
                    <div key={g.month} className="flex flex-col items-center gap-1">
                      <div className="text-[10px] text-rose-200">{g.month}월</div>
                      <div className="flex -space-x-2">
                        {g.cards.map((c) => (
                          <Card key={c.id} card={c} width={36} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <div className="grid grid-cols-2 gap-3">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() =>
                  onApply({
                    shakeMonths: detection.shakeMonths.map((g) => g.month),
                    bombMonths: detection.bombMonths.map((g) => g.month),
                  })
                }
                className="rounded-lg bg-amber-500 px-4 py-3 text-lg font-black text-slate-950 shadow-lg shadow-amber-900/50 hover:bg-amber-400"
              >
                ✓ 적용 (×2 배수)
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={onSkip}
                className="rounded-lg bg-slate-600 px-4 py-3 text-lg font-bold text-white shadow-lg hover:bg-slate-500"
              >
                건너뛰기
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
