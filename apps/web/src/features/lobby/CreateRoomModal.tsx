import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PasswordInput } from './PasswordInput.tsx';

interface CreateRoomModalProps {
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onCreate: (opts: {
    password?: string;
    asSpectator: boolean;
    mediaMode: 'video' | 'voice-only';
  }) => void;
}

/**
 * 방 만들기 모달 — 비밀번호 + 관전자 + 화상/음성 옵션.
 * 비번 안 넣으면 오픈방, 4~20자 입력하면 비밀방.
 */
export function CreateRoomModal({
  open,
  busy = false,
  onClose,
  onCreate,
}: CreateRoomModalProps) {
  const [password, setPassword] = useState('');
  const [asSpectator, setAsSpectator] = useState(false);
  const [mediaMode, setMediaMode] = useState<'video' | 'voice-only'>('video');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPassword('');
    setAsSpectator(false);
    setMediaMode('video');
    setErr(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  function handleCreate() {
    if (password && (password.length < 4 || password.length > 20)) {
      setErr('비밀번호는 4~20자');
      return;
    }
    onCreate({ password: password || undefined, asSpectator, mediaMode });
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.92, y: 8 }}
            transition={{ type: 'spring', stiffness: 220, damping: 22 }}
            className="w-full max-w-md rounded-2xl border-2 border-amber-700/60 bg-green-900 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-amber-400">새 게임방 만들기</h3>
              <button
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded text-green-300 hover:bg-green-950"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>
            <p className="mb-4 text-xs text-green-300">
              친구들을 초대할 방을 만들어보세요. 한 방 최대 5명, 게임 시작 시 인원에 따라 자동 분기됩니다 (2~3명: 일반 / 4~5명: 광팔이).
            </p>

            <div className="flex flex-col gap-4">
              {/* 비밀번호 */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-green-200">
                  비밀번호 <span className="text-green-400">(선택 — 비우면 오픈방)</span>
                </label>
                <PasswordInput
                  value={password}
                  onChange={setPassword}
                  placeholder="4~20자, 비우면 누구나 입장 가능"
                />
              </div>

              {/* 화상/음성 모드 */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-green-200">
                  미디어 모드
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMediaMode('video')}
                    className={`flex-1 rounded-md border px-3 py-2 text-xs font-bold transition ${
                      mediaMode === 'video'
                        ? 'border-amber-400 bg-amber-500/20 text-amber-100'
                        : 'border-green-700 bg-green-950/40 text-green-300 hover:bg-green-900/40'
                    }`}
                  >
                    🎥 화상 + 음성
                  </button>
                  <button
                    type="button"
                    onClick={() => setMediaMode('voice-only')}
                    className={`flex-1 rounded-md border px-3 py-2 text-xs font-bold transition ${
                      mediaMode === 'voice-only'
                        ? 'border-amber-400 bg-amber-500/20 text-amber-100'
                        : 'border-green-700 bg-green-950/40 text-green-300 hover:bg-green-900/40'
                    }`}
                  >
                    🎙️ 음성 전용
                  </button>
                </div>
                <p className="mt-1 text-[10px] text-green-400">
                  음성 전용은 카메라 없이 마이크만 — 데이터·배터리 절약
                </p>
              </div>

              {/* 관전자 옵션 — 모바일 오터치 방지를 위해 명시적 토글 버튼 형태로 */}
              <button
                type="button"
                onClick={() => setAsSpectator((v) => !v)}
                className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm font-semibold transition ${
                  asSpectator
                    ? 'border-amber-400/60 bg-amber-500/15 text-amber-100'
                    : 'border-green-700/60 bg-green-950/40 text-green-200 hover:bg-green-900/40'
                }`}
              >
                <span>👁️ 관전자로 입장 (게임 X, 채팅만)</span>
                <span className="text-xs">{asSpectator ? 'ON' : 'OFF'}</span>
              </button>

              {err && (
                <div className="rounded border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                  {err}
                </div>
              )}
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 rounded-md border border-green-700 bg-green-950/50 px-4 py-2 text-sm font-semibold text-green-200 hover:bg-green-900"
              >
                취소
              </button>
              <button
                onClick={handleCreate}
                disabled={busy}
                className="flex-1 rounded-md bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-500 disabled:opacity-50"
              >
                {busy ? '생성 중...' : '방 만들기'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
