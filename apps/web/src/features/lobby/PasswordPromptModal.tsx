import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PasswordInput } from './PasswordInput.tsx';

interface PasswordPromptModalProps {
  open: boolean;
  hostNickname: string;
  busy?: boolean;
  err?: string | null;
  onClose: () => void;
  onSubmit: (password: string) => void;
}

/**
 * 비밀방 입장 시 비밀번호 입력 모달.
 */
export function PasswordPromptModal({
  open,
  hostNickname,
  busy = false,
  err,
  onClose,
  onSubmit,
}: PasswordPromptModalProps) {
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (!open) return;
    setPassword('');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

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
            className="w-full max-w-sm rounded-2xl border-2 border-amber-700/60 bg-green-900 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="text-lg">🔒</span>
              <h3 className="text-base font-bold text-amber-400">비밀방 입장</h3>
            </div>
            <p className="mb-4 text-xs text-green-300">
              <span className="font-semibold text-green-100">{hostNickname}의 방</span>은
              비밀방입니다. 비밀번호를 입력해 주세요.
            </p>

            <PasswordInput
              value={password}
              onChange={setPassword}
              onEnter={() => {
                if (password.length >= 4 && !busy) onSubmit(password);
              }}
              autoFocus
              placeholder="비밀번호 (4~20자)"
            />

            {err && (
              <div className="mt-3 rounded border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                {err}
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 rounded-md border border-green-700 bg-green-950/50 px-3 py-2 text-sm font-semibold text-green-200 hover:bg-green-900"
              >
                취소
              </button>
              <button
                onClick={() => onSubmit(password)}
                disabled={busy || password.length < 4}
                className="flex-1 rounded-md bg-amber-600 px-3 py-2 text-sm font-bold text-white hover:bg-amber-500 disabled:opacity-50"
              >
                {busy ? '확인 중...' : '입장'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
