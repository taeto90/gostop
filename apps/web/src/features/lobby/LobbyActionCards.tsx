interface ActionCardsProps {
  onCreateRoom: () => void;
  busy?: boolean;
}

/**
 * 좌측 컬럼의 액션 카드 — 친구와 게임 (방 만들기).
 * 혼자 연습은 멀티 1인 = 1:1 AI 봇 자동 합류로 통일됨 (별도 라우트 없음).
 */
export function LobbyActionCards({
  onCreateRoom,
  busy = false,
}: ActionCardsProps) {
  return (
    <button
      onClick={onCreateRoom}
      disabled={busy}
      className="group block w-full rounded-xl border border-purple-600/50 bg-gradient-to-br from-purple-900/40 to-purple-800/40 p-4 text-left backdrop-blur-sm transition-all hover:border-purple-400/60 hover:shadow-lg hover:shadow-purple-500/20 disabled:opacity-50 sm:p-5"
    >
      <div className="mb-3 flex items-center gap-3">
        <div className="rounded-lg bg-purple-600/30 p-2">
          <UsersIcon />
        </div>
        <div>
          <h3 className="text-base font-bold text-purple-200 sm:text-lg">
            게임 시작
          </h3>
          <p className="text-[11px] text-purple-300/70 sm:text-xs">
            방 만들기 — 혼자면 AI 봇 자동 합류
          </p>
        </div>
      </div>
      <div className="flex items-center justify-center gap-2 rounded-md bg-purple-600 py-2 text-sm font-semibold text-white transition group-hover:bg-purple-500">
        <PlusIcon />
        <span>방 만들기</span>
      </div>
    </button>
  );
}

function UsersIcon() {
  return (
    <svg className="h-5 w-5 text-purple-300" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
    </svg>
  );
}
