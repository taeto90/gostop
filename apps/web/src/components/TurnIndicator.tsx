interface TurnIndicatorProps {
  isCurrent: boolean;
  goCount?: number;
  size?: 'sm' | 'md';
}

/**
 * "선" 마커 + 고 횟수 뱃지. 차례 플레이어에게만 표시.
 */
export function TurnIndicator({ isCurrent, goCount = 0, size = 'sm' }: TurnIndicatorProps) {
  if (!isCurrent && goCount === 0) return null;

  const cls = size === 'md' ? 'text-sm px-2 py-0.5' : 'text-[10px] px-1.5 py-0.5';

  return (
    <div className="flex items-center gap-1">
      {isCurrent && (
        <span
          className={`${cls} rounded-full border border-amber-300 bg-amber-400/30 font-bold text-amber-200 shadow-sm`}
        >
          先
        </span>
      )}
      {goCount > 0 && (
        <span
          className={`${cls} rounded-full bg-rose-500/80 font-bold text-white shadow-sm`}
        >
          고 ×{goCount}
        </span>
      )}
    </div>
  );
}
