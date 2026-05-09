import type { RoomListItem } from '@gostop/shared';

interface LobbyResumeCardProps {
  room: RoomListItem;
  onResume: () => void;
}

/**
 * 로비 좌측 — 이전에 입장해 있던 방이 있으면 노출되는 "돌아가기" 카드.
 * 한 사용자 한 방 정책상 결과는 0~1개. RoomScreen 자동 rejoin 흐름이 처리.
 */
export function LobbyResumeCard({ room, onResume }: LobbyResumeCardProps) {
  const isPlaying = room.phase === 'playing';
  return (
    <button
      onClick={onResume}
      className="group block w-full rounded-xl border-2 border-amber-400/60 bg-gradient-to-br from-amber-900/40 to-amber-800/30 p-4 text-left backdrop-blur-sm transition-all hover:border-amber-300/80 hover:shadow-lg hover:shadow-amber-500/30 sm:p-5"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
          ▶ 진행 중인 방
        </span>
        <span
          className={`rounded px-2 py-0.5 text-[10px] font-bold ${
            isPlaying
              ? 'bg-rose-500/30 text-rose-200'
              : 'bg-emerald-500/30 text-emerald-200'
          }`}
        >
          {isPlaying ? '게임중' : '대기중'}
        </span>
      </div>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-2xl">{room.hostEmoji}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-amber-100">
            {room.hostNickname}의 방
          </div>
          <div className="text-[11px] text-amber-300/70">방 ID: {room.id}</div>
        </div>
        <span className="text-[11px] text-amber-200">
          {room.playerCount}/{room.maxPlayers}
        </span>
      </div>
      <div className="rounded-md bg-amber-500 py-2 text-center text-sm font-bold text-slate-950 transition group-hover:bg-amber-400">
        🎮 돌아가기
      </div>
    </button>
  );
}
