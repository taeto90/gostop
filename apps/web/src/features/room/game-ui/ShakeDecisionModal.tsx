import { AnimatePresence, motion } from 'framer-motion';
import type { Card as CardType } from '@gostop/shared';
import { Card } from '../../../components/Card.tsx';

/**
 * 게임 도중 흔들기 선언 모달 (rules-final.md §4-1).
 *
 * 본인 turn에서 같은 월 3장 보유 + 그 월 카드 클릭 시 발동.
 * 사용자가 [O] 선택 시 흔들기 선언 (점수 ×2). [X] 선택 시 일반 매칭.
 */
interface ShakeDecisionModalProps {
  open: boolean;
  month: number;
  cards: CardType[];
  onShake: () => void;
  onDecline: () => void;
  /** 카드 클릭 취소 — 손패 그대로 유지 (모달만 닫음) */
  onCancel: () => void;
}

export function ShakeDecisionModal({
  open,
  month,
  cards,
  onShake,
  onDecline,
  onCancel,
}: ShakeDecisionModalProps) {
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
            className="w-full max-w-md rounded-2xl border-2 border-amber-400/60 bg-gradient-to-b from-felt-800 to-felt-950 p-5 shadow-2xl"
          >
            <div className="mb-3 text-center">
              <div className="text-xs font-semibold text-amber-300">기회 발견!</div>
              <div className="text-2xl font-black text-amber-200">💪 흔들기 선언?</div>
            </div>

            <p className="mb-4 text-center text-sm text-felt-200">
              <span className="font-bold text-amber-200">{month}월</span> 카드 3장 보유.
              <br />
              흔들기 선언 시 점수 <span className="font-bold text-amber-300">×2</span> 배수.
            </p>

            <section className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
              <div className="flex justify-center gap-1">
                {cards.map((c) => (
                  <Card key={c.id} card={c} width={56} />
                ))}
              </div>
            </section>

            <div className="grid grid-cols-2 gap-3">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={onShake}
                className="rounded-lg bg-amber-500 px-4 py-3 text-lg font-black text-slate-950 shadow-lg shadow-amber-900/50 hover:bg-amber-400"
              >
                💪 흔들기 (×2)
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={onDecline}
                className="rounded-lg bg-slate-600 px-4 py-3 text-lg font-bold text-white shadow-lg hover:bg-slate-500"
              >
                일반 매칭
              </motion.button>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onCancel}
              className="mt-2 w-full rounded-lg border border-felt-700 bg-felt-900/60 px-4 py-2 text-sm font-bold text-felt-300 hover:bg-felt-800"
            >
              취소 (다른 카드 선택)
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * 흔들기 O 선언 후 바닥에 매칭 패 있을 때 발동 (rules-final.md §4-2 ①/②).
 *
 * [폭탄] 선택 시 3장 한 번에 + 바닥 1장 = 4장 collected + 상대 피 1장씩 + 보너스 카드 2장.
 * [1장 내기] 선택 시 declineBomb=true로 server에 전달. 1장만 매칭, 점수 ×2만.
 */
interface BombChoiceModalProps {
  open: boolean;
  month: number;
  handCards: CardType[];
  fieldCard: CardType | undefined;
  onBomb: () => void;
  onSingle: () => void;
  /** 카드 클릭 취소 — 손패 그대로 (모달만 닫음). 흔들기 선언은 이미 server에 보낸 상태 */
  onCancel: () => void;
}

export function BombChoiceModal({
  open,
  month,
  handCards,
  fieldCard,
  onBomb,
  onSingle,
  onCancel,
}: BombChoiceModalProps) {
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
            className="w-full max-w-md rounded-2xl border-2 border-rose-400/60 bg-gradient-to-b from-felt-800 to-felt-950 p-5 shadow-2xl"
          >
            <div className="mb-3 text-center">
              <div className="text-xs font-semibold text-rose-300">폭탄 가능!</div>
              <div className="text-2xl font-black text-rose-200">💣 폭탄 발동?</div>
            </div>

            <p className="mb-4 text-center text-sm text-felt-200">
              바닥에 <span className="font-bold text-rose-200">{month}월</span> 카드가 있음.
              <br />
              폭탄으로 3장 한 번에 가져가기 (보너스 카드 2장).
            </p>

            <section className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3">
              <div className="mb-2 text-center text-[11px] text-rose-300">손패 3장</div>
              <div className="mb-3 flex justify-center gap-1">
                {handCards.map((c) => (
                  <Card key={c.id} card={c} width={48} />
                ))}
              </div>
              {fieldCard && (
                <>
                  <div className="mb-2 text-center text-[11px] text-rose-300">바닥</div>
                  <div className="flex justify-center">
                    <Card card={fieldCard} width={48} />
                  </div>
                </>
              )}
            </section>

            <div className="grid grid-cols-2 gap-3">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={onBomb}
                className="rounded-lg bg-rose-500 px-4 py-3 text-base font-black text-white shadow-lg shadow-rose-900/50 hover:bg-rose-400"
              >
                💣 폭탄 (4장 + 보너스)
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={onSingle}
                className="rounded-lg bg-slate-600 px-4 py-3 text-base font-bold text-white shadow-lg hover:bg-slate-500"
              >
                1장만 내기
              </motion.button>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onCancel}
              className="mt-2 w-full rounded-lg border border-felt-700 bg-felt-900/60 px-4 py-2 text-sm font-bold text-felt-300 hover:bg-felt-800"
            >
              취소 (다른 카드 선택)
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
