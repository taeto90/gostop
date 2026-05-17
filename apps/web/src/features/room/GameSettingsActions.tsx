/**
 * SettingsModal의 `playerSection` / `hostSection` 안에 들어갈 게임 액션 버튼들.
 *
 * - 호스트 한정: 방 룰 설정 진입
 * - 본인 한정: 쇼당 선언
 *
 * 9월 끗 토글은 제거됨 — collected로 이동 시점에 `NineYeolPickerModal`이 자동 발동.
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
