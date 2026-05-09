import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getVolume, isMuted, setMuted, setVolume } from '../lib/sound.ts';
import { HelpModal } from './HelpModal.tsx';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  /** LiveKit context 안에서만 렌더되는 카메라/마이크 토글 섹션 */
  mediaSettings?: React.ReactNode;
  /** 호스트 한정 — 방 룰 설정 진입 버튼 등을 노출할 영역 */
  hostSection?: React.ReactNode;
  /** 본인 한정 — 9월 열끗 토글 등 게임 중 본인 결정 액션 */
  playerSection?: React.ReactNode;
}

/**
 * 게임 화면/대기실에서 ⚙️ 버튼으로 호출.
 *
 * 항상 표시: 사운드 볼륨 슬라이더 + 음소거 토글
 * 멀티(LiveKit context 안)에서만: mediaSettings prop으로 카메라/마이크 토글
 */
export function SettingsModal({
  open,
  onClose,
  mediaSettings,
  hostSection,
  playerSection,
}: SettingsModalProps) {
  const [vol, setVol] = useState(() => getVolume());
  const [mute, setMute] = useState(() => isMuted());
  const [helpOpen, setHelpOpen] = useState(false);

  // 모달 열릴 때 최신값 반영
  useEffect(() => {
    if (!open) return;
    setVol(getVolume());
    setMute(isMuted());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  function changeVolume(v: number) {
    setVol(v);
    setVolume(v);
    if (v > 0 && mute) {
      setMuted(false);
      setMute(false);
    }
  }

  function toggleMute() {
    const next = !mute;
    setMuted(next);
    setMute(next);
  }

  return (
    <>
      <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 8 }}
            transition={{ type: 'spring', stiffness: 220, damping: 22 }}
            className="flex max-h-[90vh] w-full max-w-sm flex-col overflow-y-auto rounded-2xl border-2 border-amber-400/40 bg-felt-900 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="text-base font-bold text-felt-100">⚙️ 설정</span>
              <button
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded bg-felt-950/60 text-felt-300 hover:bg-felt-800"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>

            {mediaSettings && (
              <>
                {mediaSettings}
                <div className="my-4 h-px bg-felt-800/70" />
              </>
            )}

            {hostSection && (
              <>
                {hostSection}
                <div className="my-4 h-px bg-felt-800/70" />
              </>
            )}

            {playerSection && (
              <>
                {playerSection}
                <div className="my-4 h-px bg-felt-800/70" />
              </>
            )}

            <div className="flex flex-col gap-2">
              <div className="text-[11px] font-bold text-felt-300">🔊 사운드</div>

              <button
                onClick={toggleMute}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition ${
                  mute
                    ? 'border-rose-400/60 bg-rose-500/10 text-rose-200'
                    : 'border-felt-700/60 bg-felt-950/60 text-felt-300 hover:bg-felt-800'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="text-base">{mute ? '🔇' : '🔊'}</span>
                  <span>{mute ? '음소거됨' : '소리 켜짐'}</span>
                </span>
                <span className="font-bold">{mute ? 'OFF' : 'ON'}</span>
              </button>

              <button
                onClick={() => setHelpOpen(true)}
                className="flex items-center justify-between rounded-lg border border-felt-700/60 bg-felt-950/60 px-3 py-2 text-sm text-felt-300 transition hover:bg-felt-800"
              >
                <span className="flex items-center gap-2">
                  <span className="text-base">📖</span>
                  <span>화투 룰 가이드</span>
                </span>
                <span className="text-felt-500">→</span>
              </button>

              <label className="flex items-center gap-3 rounded-lg border border-felt-700/60 bg-felt-950/40 px-3 py-2.5 text-sm">
                <span className="w-12 text-felt-300">볼륨</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(vol * 100)}
                  onChange={(e) => changeVolume(Number(e.target.value) / 100)}
                  className="flex-1 accent-amber-400"
                  aria-label="사운드 볼륨"
                />
                <span className="w-10 text-right text-xs font-bold text-felt-100">
                  {Math.round(vol * 100)}
                </span>
              </label>
            </div>

          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
      {/* HelpModal은 AnimatePresence 외부 — 중첩 motion 충돌 회피 */}
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}
