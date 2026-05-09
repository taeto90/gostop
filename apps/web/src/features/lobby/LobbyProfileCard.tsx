import { useGameHistoryStore } from '../../stores/gameHistoryStore.ts';
import { useSessionStore } from '../../stores/sessionStore.ts';

interface ProfileCardProps {
  nickname: string;
  emojiAvatar: string;
  myUserId: string;
}

/**
 * 좌측 프로필 카드 — 닉네임 + 아바타 + 통계 (게임 히스토리 기반).
 * 레벨은 단순 — 총 게임 수 / 5 + 1 (친구 MVP 임시).
 */
export function LobbyProfileCard({
  nickname,
  emojiAvatar,
  myUserId,
}: ProfileCardProps) {
  const entries = useGameHistoryStore((s) => s.entries);
  const myEntries = entries.filter((e) => e.myUserId === myUserId);
  const wins = myEntries.filter((e) => e.amWinner).length;
  const level = Math.floor(myEntries.length / 5) + 1;
  const rank = wins >= 50 ? '고수' : wins >= 20 ? '중수' : wins >= 5 ? '초수' : '입문';

  return (
    <div className="rounded-xl border border-amber-700/50 bg-green-900/40 p-4 backdrop-blur-sm sm:p-5">
      <h3 className="mb-3 text-base font-bold text-amber-400 sm:text-lg">내 프로필</h3>
      <div className="mb-4 flex items-center gap-3 sm:gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-amber-500 bg-green-950 text-3xl shadow-lg sm:h-16 sm:w-16 sm:text-4xl">
          {emojiAvatar}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-base font-bold text-white sm:text-lg">
            {nickname}
          </h4>
          <span className="mt-1 inline-block rounded-md bg-amber-600 px-2 py-0.5 text-[10px] font-semibold text-white sm:text-xs">
            {rank}
          </span>
        </div>
        <button
          onClick={() => useSessionStore.getState().clearProfile()}
          className="self-start text-[10px] text-green-300/60 hover:text-green-200 sm:text-xs"
        >
          변경
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <StatBox icon="⭐" label="레벨" value={level} />
        <StatBox icon="🏆" label="승리" value={wins} />
      </div>
    </div>
  );
}

function StatBox({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-green-700/30 bg-green-950/50 px-2 py-2 text-center sm:px-3 sm:py-3">
      <div className="mb-1 flex items-center justify-center gap-1 text-[10px] text-green-300 sm:text-xs">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <p className="text-lg font-bold text-white sm:text-xl">{value}</p>
    </div>
  );
}
