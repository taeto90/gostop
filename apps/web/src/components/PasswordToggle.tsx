import { useState } from 'react';
import { emitWithAck } from '../lib/socket.ts';
import { toast } from '../stores/toastStore.ts';

interface PasswordToggleProps {
  hasPassword: boolean;
  editable: boolean;
}

export function PasswordToggle({ hasPassword, editable }: PasswordToggleProps) {
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);

  async function togglePassword() {
    if (hasPassword) {
      setBusy(true);
      await emitWithAck('room:update-rules', { rules: {}, password: '' });
      setBusy(false);
      toast.success('비밀번호 해제됨');
    } else {
      setPwOpen(true);
    }
  }

  async function savePassword() {
    if (pw.length < 4 || pw.length > 20) {
      toast.error('비밀번호는 4~20자');
      return;
    }
    setBusy(true);
    const r = await emitWithAck('room:update-rules', { rules: {}, password: pw });
    setBusy(false);
    if (r.ok) {
      setPwOpen(false);
      setPw('');
      toast.success('비밀번호 설정됨');
    } else {
      toast.error(r.error);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={editable ? () => void togglePassword() : undefined}
        disabled={!editable || busy}
        className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs font-semibold transition ${
          hasPassword
            ? 'border-amber-500/50 bg-amber-500/15 text-amber-200'
            : 'border-felt-700/60 bg-felt-950/40 text-felt-300'
        } ${editable ? 'cursor-pointer hover:border-amber-400/60' : 'cursor-default'}`}
      >
        <span>{hasPassword ? '🔒 비공개방' : '🔓 공개방'}</span>
        {hasPassword && !editable && (
          <span className="font-mono text-[10px] tracking-widest text-amber-400/70">****</span>
        )}
      </button>

      {pwOpen && editable && (
        <div className="flex gap-2">
          <input
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            maxLength={20}
            placeholder="비밀번호 4~20자"
            className="flex-1 rounded-lg border border-felt-700 bg-felt-950 px-3 py-2 text-sm text-felt-100 placeholder-felt-500 focus:border-amber-400 focus:outline-none"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') void savePassword();
              if (e.key === 'Escape') setPwOpen(false);
            }}
          />
          <button
            onClick={() => void savePassword()}
            disabled={busy}
            className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
          >
            설정
          </button>
          <button
            onClick={() => setPwOpen(false)}
            className="rounded-lg border border-felt-700 px-3 py-2 text-xs text-felt-300 hover:bg-felt-800"
          >
            취소
          </button>
        </div>
      )}
    </div>
  );
}
