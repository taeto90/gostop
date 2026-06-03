import { PasswordToggle } from '../../components/PasswordToggle.tsx';

interface HostSectionProps {
  onOpenRules: () => void;
  hasPassword: boolean;
}

export function HostRulesAction({ onOpenRules, hasPassword }: HostSectionProps) {
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
      <PasswordToggle hasPassword={hasPassword} editable />
    </div>
  );
}
