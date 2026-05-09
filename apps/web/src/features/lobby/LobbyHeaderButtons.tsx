interface LobbyHeaderButtonsProps {
  onOpenHistory: () => void;
  onOpenHelp: () => void;
}

/** 로비 우상단 (전적 / 도움말) 토글 버튼 그룹 */
export function LobbyHeaderButtons({
  onOpenHistory,
  onOpenHelp,
}: LobbyHeaderButtonsProps) {
  return (
    <div className="absolute right-3 top-3 flex gap-2 lg:right-6 lg:top-6">
      <button
        onClick={onOpenHistory}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-lg shadow-lg transition hover:bg-slate-700 lg:h-11 lg:w-11 lg:text-2xl"
        title="전적"
        aria-label="전적"
      >
        📊
      </button>
      <button
        onClick={onOpenHelp}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-lg shadow-lg transition hover:bg-slate-700 lg:h-11 lg:w-11 lg:text-2xl"
        title="화투 룰 가이드"
        aria-label="도움말"
      >
        ❓
      </button>
    </div>
  );
}
