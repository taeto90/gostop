import { AnimatePresence, motion } from 'framer-motion';
import { calculateScore, type PlayerStateView } from '@gostop/shared';
import { computeMultiplier } from '../../../lib/multiplierUtils.ts';

interface ScoreDetailModalProps {
  open: boolean;
  player: PlayerStateView | null;
  allowGukJoon?: boolean;
  onClose: () => void;
}

export function ScoreDetailModal({
  open,
  player,
  allowGukJoon = true,
  onClose,
}: ScoreDetailModalProps) {
  if (!player) return null;

  const s = calculateScore(player.collected, {
    nineYeolAsSsangPi: player.flags?.nineYeolAsSsangPi ?? false,
    allowGukJoon,
  });
  const mul = computeMultiplier(player);
  const shookMonths = (player.flags?.shookMonths as number[]) ?? [];
  const goCount = player.goCount ?? 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="w-full max-w-xs rounded-2xl border-2 border-amber-400/50 bg-felt-900 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{player.emojiAvatar}</span>
                <span className="font-bold text-white">{player.nickname}</span>
              </div>
              <button
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded bg-felt-950/60 text-felt-300 hover:bg-felt-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <ScoreRow label="광" value={s.gwang} />
              <ScoreRow label="고도리" value={s.godori} />
              <ScoreRow label="끗" value={s.yeol} />
              <ScoreRow label="띠" value={s.ddi} />
              <ScoreRow label="단" value={s.dan} />
              <ScoreRow label="피" value={s.pi} />

              <div className="border-t border-felt-700/60 pt-2">
                <div className="flex items-center justify-between text-base font-bold">
                  <span className="text-felt-200">합계</span>
                  <span className="text-amber-300">{s.total}점</span>
                </div>
              </div>

              {mul > 1 && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                  <div className="mb-1 text-xs font-bold text-amber-300">배수 ×{mul}</div>
                  {shookMonths.length > 0 && (
                    <div className="text-xs text-amber-200">
                      💪 흔들기: {shookMonths.map((m) => `${m}월`).join(', ')} (×{2 ** shookMonths.length})
                    </div>
                  )}
                  {goCount >= 3 && (
                    <div className="text-xs text-amber-200">
                      🔥 {goCount}고 (×{2 ** (goCount - 2)})
                    </div>
                  )}
                  {goCount > 0 && goCount < 3 && (
                    <div className="text-xs text-amber-200">
                      🔥 {goCount}고
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ScoreRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-felt-300">{label}</span>
      <span className={value > 0 ? 'font-bold text-white' : 'text-felt-500'}>
        {value > 0 ? `${value}점` : '-'}
      </span>
    </div>
  );
}
