import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface InviteLinkProps {
  roomId: string;
}

export function InviteLink({ roomId }: InviteLinkProps) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/room/${roomId}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드 권한 없음 (HTTP 등). 무시.
    }
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
      <div className="mb-3 text-sm font-semibold text-slate-300">친구 초대</div>
      <div className="flex flex-wrap items-center gap-4">
        <div className="rounded bg-white p-2">
          <QRCodeSVG value={url} size={96} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-xs text-slate-500">방 ID</div>
          <div className="mb-2 font-mono text-2xl font-bold tracking-wider text-amber-300">
            {roomId}
          </div>
          <div className="mb-2 truncate text-xs text-slate-400">{url}</div>
          <button
            onClick={copy}
            className="rounded bg-amber-500/20 px-3 py-1 text-xs text-amber-300 hover:bg-amber-500/30"
          >
            {copied ? '복사됨!' : '링크 복사'}
          </button>
        </div>
      </div>
    </div>
  );
}
