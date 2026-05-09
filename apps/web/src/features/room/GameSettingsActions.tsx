/**
 * SettingsModal의 `playerSection` / `hostSection` 안에 들어갈 게임 액션 버튼들.
 *
 * - 호스트 한정: 방 룰 설정 진입
 * - 본인 한정: 9월 열끗 토글, 쇼당 선언
 */

interface HostSectionProps {
  onOpenRules: () => void;
}

export function HostRulesAction({ onOpenRules }: HostSectionProps) {
  return (
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
  );
}

interface PlayerActionsProps {
  has9Yeol: boolean;
  my9YeolAsSsangPi: boolean;
  onToggle9Yeol: () => void;
  canDeclareShodang: boolean;
  onDeclareShodang: () => void;
}

export function PlayerActions({
  has9Yeol,
  my9YeolAsSsangPi,
  onToggle9Yeol,
  canDeclareShodang,
  onDeclareShodang,
}: PlayerActionsProps) {
  if (!has9Yeol && !canDeclareShodang) return null;
  return (
    <div className="flex flex-col gap-2">
      {has9Yeol && (
        <button
          onClick={onToggle9Yeol}
          className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition ${
            my9YeolAsSsangPi
              ? 'border-rose-400/60 bg-rose-500/10 text-rose-200'
              : 'border-sky-400/60 bg-sky-500/10 text-sky-200'
          }`}
        >
          <span className="flex items-center gap-2">
            <span className="text-base">🌼</span>
            <span>
              9월 열끗 →{' '}
              <span className="font-bold">
                {my9YeolAsSsangPi ? '쌍피로 사용' : '끗으로 사용'}
              </span>
            </span>
          </span>
          <span className="text-felt-400">↔</span>
        </button>
      )}
      {canDeclareShodang && (
        <button
          onClick={onDeclareShodang}
          className="flex items-center justify-between rounded-lg border border-amber-400/60 bg-amber-500/10 px-3 py-2 text-sm text-amber-200 transition hover:bg-amber-500/20"
        >
          <span className="flex items-center gap-2">
            <span className="text-base">🚫</span>
            <span>
              쇼당 선언{' '}
              <span className="text-felt-400">(친구간 협의 룰)</span>
            </span>
          </span>
          <span className="text-amber-300">→</span>
        </button>
      )}
    </div>
  );
}
