import { motion, AnimatePresence } from 'framer-motion';
import type { Card as CardType } from '@gostop/shared';
import { Card } from '../../../components/Card.tsx';
import {
  MODAL_SCALE_ANIMATE,
  MODAL_SCALE_EXIT,
  MODAL_SCALE_INITIAL,
  MODAL_SPRING,
} from '../../../lib/animationTiming.ts';

interface TargetPickerModalProps {
  open: boolean;
  /** 어떤 손패 카드를 냈는지 */
  handCard: CardType | null;
  /** 매칭 후보 카드들 */
  candidates: CardType[];
  onPick: (cardId: string) => void;
  onCancel: () => void;
}

/**
 * 바닥에 같은 월 카드가 여러 장일 때 어느 카드를 가져갈지 선택.
 */
export function TargetPickerModal({
  open,
  handCard,
  candidates,
  onPick,
  onCancel,
}: TargetPickerModalProps) {
  return (
    <AnimatePresence>
      {open && (
        // 배경 어둡게 X — 본인 손패/딴패 보면서 어떤 카드 선택할지 판단 가능해야 함.
        // pointer-events-none + 모달 자체에만 pointer-events-auto.
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-3"
        >
          <motion.div
            initial={MODAL_SCALE_INITIAL}
            animate={MODAL_SCALE_ANIMATE}
            exit={MODAL_SCALE_EXIT}
            transition={MODAL_SPRING}
            className="pointer-events-auto max-h-[92vh] overflow-y-auto rounded-2xl border-2 border-amber-400 bg-felt-900 p-4 shadow-[0_0_40px_rgba(251,191,36,0.5)] sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 text-center">
              <div className="text-xs font-semibold text-amber-300">바닥에 같은 월 카드가 여러 장</div>
              <div className="text-xl font-bold text-felt-50">
                어떤 카드를 가져가시겠어요?
              </div>
            </div>

            {handCard && (
              <div className="mb-4 flex items-center justify-center gap-3">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] text-felt-300">내가 낸 카드</span>
                  <Card card={handCard} width={70} />
                </div>
                <span className="text-3xl text-amber-300">+</span>
                <span className="text-3xl text-felt-300">?</span>
              </div>
            )}

            <div className="flex justify-center gap-3">
              {candidates.map((card) => (
                <motion.button
                  key={card.id}
                  whileHover={{ y: -8, scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onPick(card.id)}
                  className="flex flex-col items-center gap-1.5 rounded-lg border-2 border-felt-900 bg-felt-950/40 p-2 transition hover:border-amber-400"
                >
                  <Card card={card} width={70} />
                  <span className="text-xs font-semibold text-felt-200">선택</span>
                </motion.button>
              ))}
            </div>

            <div className="mt-4 text-center">
              <button
                onClick={onCancel}
                className="text-xs text-felt-400 hover:text-felt-200"
              >
                취소
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
