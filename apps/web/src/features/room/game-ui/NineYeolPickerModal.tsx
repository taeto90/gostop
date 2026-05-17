import { motion, AnimatePresence } from 'framer-motion';
import { getCardById } from '@gostop/shared';
import { Card } from '../../../components/Card.tsx';

interface NineYeolPickerModalProps {
  open: boolean;
  onPick: (asSsangPi: boolean) => void;
}

/**
 * 9월 열끗(국준) 획득 시 끗/쌍피 자리 선택 모달 (rules-final.md §1-5).
 * collected에 m09-yeol이 새로 추가되는 순간 자동 mount.
 *
 * 정통 한국 룰 — 국준은 끗 또는 쌍피로 자유 선택 가능. 사용자가 결정하면
 * `Player.flags.nineYeolAsSsangPi`에 저장되어 점수 계산에 반영.
 */
export function NineYeolPickerModal({ open, onPick }: NineYeolPickerModalProps) {
  const card = getCardById('m09-yeol');

  return (
    <AnimatePresence>
      {open && card && (
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
            className="w-full max-w-md rounded-2xl border-2 border-amber-400/60 bg-gradient-to-b from-felt-800 to-felt-950 p-5 shadow-2xl"
          >
            <div className="mb-3 text-center">
              <div className="text-xs font-semibold text-amber-300">국준 획득!</div>
              <div className="text-2xl font-black text-amber-200">🌼 9월 열끗 자리 선택</div>
            </div>

            <p className="mb-4 text-center text-sm text-felt-200">
              9월 열끗(국준)을 끗으로 사용할지, 쌍피로 사용할지 선택하세요.
              <br />
              <span className="text-[11px] text-felt-300">
                (rules-final.md §1-5 — 정통 한국 룰. 추후 게임 중 변경 X)
              </span>
            </p>

            <div className="mb-4 flex justify-center">
              <Card card={card} width={64} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onPick(false)}
                className="rounded-lg border border-sky-400/60 bg-sky-500/20 px-4 py-3 text-base font-black text-sky-100 shadow-lg hover:bg-sky-500/30"
              >
                📜 끗으로
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onPick(true)}
                className="rounded-lg border border-rose-400/60 bg-rose-500/20 px-4 py-3 text-base font-black text-rose-100 shadow-lg hover:bg-rose-500/30"
              >
                💕 쌍피로
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
