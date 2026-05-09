import { useEffect, useState } from 'react';
import type { RoomListItem } from '@gostop/shared';
import { emitWithAck } from '../../lib/socket.ts';

interface RoomListProps {
  onJoinRoom: (room: RoomListItem) => void;
  /** 6자리 ID로 입장 (방 목록에 없는 방, 또는 직접 ID 입력) */
  onJoinById: (id: string) => void;
}

/**
 * 우측 컬럼 — 방 목록 표시.
 * server `room:list` 폴링 (5초 간격) + 입장 가능 / 게임중 / 잠금 표시.
 */
export function LobbyRoomList({ onJoinRoom, onJoinById }: RoomListProps) {
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinIdInput, setJoinIdInput] = useState('');

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    async function fetchRooms() {
      // 탭이 background면 스킵 (불필요한 트래픽 회피)
      if (document.hidden) return;
      const r = await emitWithAck('room:list');
      if (cancelled) return;
      if (r.ok) setRooms(r.data.rooms);
      setLoading(false);
    }
    function start() {
      void fetchRooms();
      if (timer) clearInterval(timer);
      timer = setInterval(fetchRooms, 5000);
    }
    function stop() {
      if (timer) clearInterval(timer);
      timer = null;
    }
    function onVisibility() {
      if (document.hidden) stop();
      else start();
    }
    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const waitingCount = rooms.filter((r) => r.phase === 'waiting').length;

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-amber-700/50 bg-green-900/40 backdrop-blur-sm">
      <header className="flex items-start justify-between gap-2 border-b border-amber-700/30 p-4 sm:p-5">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-amber-400 sm:text-lg">
            게임방 목록
          </h3>
          <p className="text-[11px] text-green-300 sm:text-xs">
            {loading ? '불러오는 중...' : `${waitingCount}개의 방이 대기 중`}
          </p>
        </div>
        <span className="flex-shrink-0 rounded-md border border-amber-600/50 bg-amber-600/20 px-2 py-1 text-[10px] font-semibold text-amber-300 sm:text-xs">
          {rooms.length}개 방
        </span>
      </header>

      {/* 방 ID 직접 입장 */}
      <div className="border-b border-amber-700/30 p-3 sm:p-4">
        <div className="flex gap-2">
          <input
            value={joinIdInput}
            onChange={(e) => setJoinIdInput(e.target.value.toUpperCase())}
            maxLength={6}
            placeholder="방 ID (6자)"
            className="min-w-0 flex-1 rounded-md border border-green-700 bg-green-950/50 px-3 py-2 text-center font-mono text-sm uppercase tracking-wider text-white placeholder:text-green-600 focus:border-amber-500 focus:outline-none"
          />
          <button
            onClick={() => {
              if (joinIdInput.length === 6) {
                onJoinById(joinIdInput);
                setJoinIdInput('');
              }
            }}
            disabled={joinIdInput.length !== 6}
            className="flex-shrink-0 rounded-md bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-40 sm:text-sm"
          >
            ID로 입장
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
        {rooms.length === 0 && !loading && (
          <p className="py-12 text-center text-sm text-green-400/60">
            아직 만들어진 방이 없습니다.
            <br />
            새 방을 만들어보세요!
          </p>
        )}
        <div className="flex flex-col gap-2 sm:gap-3">
          {rooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              onJoin={() => onJoinRoom(room)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function RoomCard({
  room,
  onJoin,
}: {
  room: RoomListItem;
  onJoin: () => void;
}) {
  const isPlaying = room.phase !== 'waiting';
  const total = room.playerCount + room.spectatorCount;
  const max = room.maxPlayers;
  const isFull = total >= max;
  const disabled = isPlaying || isFull;

  return (
    <div
      className={`rounded-lg border p-3 transition sm:p-4 ${
        isPlaying
          ? 'border-green-800/30 bg-green-950/30 opacity-60'
          : 'border-green-700/50 bg-green-950/50 hover:border-amber-600/50 hover:shadow-md hover:shadow-amber-500/10'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {room.hasPassword && <LockIcon />}
          <span className="text-xl sm:text-2xl">{room.hostEmoji}</span>
          <div className="min-w-0 flex-1">
            <h4 className="truncate text-sm font-semibold text-white sm:text-base">
              {room.hostNickname}의 방
            </h4>
            <p className="truncate text-[10px] text-green-400 sm:text-xs">
              방 ID: {room.id}
            </p>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <div className="flex items-center gap-1 rounded-full bg-green-950/50 px-2 py-1 sm:px-3">
            <UsersTinyIcon />
            <span className="text-[10px] font-medium text-white sm:text-xs">
              {total}/{max}
            </span>
          </div>
          {isPlaying ? (
            <span className="rounded-md border border-rose-600/50 bg-rose-600/20 px-2 py-1 text-[10px] font-semibold text-rose-300 sm:text-xs">
              게임중
            </span>
          ) : (
            <button
              onClick={onJoin}
              disabled={disabled}
              className="rounded-md bg-amber-600 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-amber-500 disabled:opacity-40 sm:px-4 sm:py-2 sm:text-xs"
            >
              {isFull ? '가득참' : '참가'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function LockIcon() {
  return (
    <svg
      className="h-4 w-4 flex-shrink-0 text-amber-500"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
    </svg>
  );
}

function UsersTinyIcon() {
  return (
    <svg className="h-3 w-3 text-green-400" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
    </svg>
  );
}
