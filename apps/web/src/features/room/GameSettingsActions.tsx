import { useState } from 'react';
import { emitWithAck } from '../../lib/socket.ts';
import { toast } from '../../stores/toastStore.ts';

interface HostSectionProps {
  onOpenRules: () => void;
  hasPassword: boolean;
}

export function HostRulesAction({ onOpenRules, hasPassword }: HostSectionProps) {
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
        onClick={onOpenRules}
        className="flex items-center justify-between rounded-lg border border-amber-400/60 bg-amber-500/10 px-3 py-2 text-sm text-amber-200 transition hover:bg-amber-500/20"
      >
        <span className="flex items-center gap-2">
          <span className="text-base">⚖️</span>
          <span>방 룰 설정 (호스트)</span>
        </span>
        <span className="text-amber-300">→</span>
      </button>

      <button
        onClick={() => void togglePassword()}
        disabled={busy}
        className="flex items-center justify-between rounded-lg border border-felt-700/60 bg-felt-950/40 px-3 py-2 text-sm text-felt-200 transition hover:bg-felt-900/60 disabled:opacity-50"
      >
        <span className="flex items-center gap-2">
          <span className="text-base">{hasPassword ? '🔒' : '🔓'}</span>
          <span>{hasPassword ? '비밀번호 해제' : '비밀번호 설정'}</span>
        </span>
      </button>

      {pwOpen && (
        <div className="flex gap-2">
          <input
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            maxLength={20}
            placeholder="비밀번호 4~20자"
            className="flex-1 rounded border border-felt-700 bg-felt-950 px-3 py-1.5 text-sm text-felt-100 placeholder-felt-500 focus:border-amber-400 focus:outline-none"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') void savePassword();
              if (e.key === 'Escape') setPwOpen(false);
            }}
          />
          <button
            onClick={() => void savePassword()}
            disabled={busy}
            className="rounded bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
          >
            설정
          </button>
        </div>
      )}
    </div>
  );
}

interface PlayerActionsProps {
  canDeclareShodang: boolean;
  onDeclareShodang: () => void;
}

export function PlayerActions({
  canDeclareShodang,
  onDeclareShodang,
}: PlayerActionsProps) {
  if (!canDeclareShodang) return null;
  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={onDeclareShodang}
        className="flex items-center justify-between rounded-lg border border-amber-400/60 bg-amber-500/10 px-3 py-2 text-sm text-amber-200 transition hover:bg-amber-500/20"
      >
        <span className="flex items-center gap-2">
          <span className="text-base">🚫</span>
          <span>
            쇼당 선언 <span className="text-felt-400">(친구간 협의 룰)</span>
          </span>
        </span>
        <span className="text-amber-300">→</span>
      </button>
    </div>
  );
}
