import type { Card as CardType } from '@gostop/shared';
import { Card } from '../../../components/Card.tsx';

export function Badge({
  color,
  children,
}: {
  color: 'amber' | 'sky' | 'rose' | 'stone';
  children: React.ReactNode;
}) {
  const colors = {
    amber: 'bg-amber-500/30 text-amber-200 border-amber-500/60',
    sky: 'bg-sky-500/30 text-sky-200 border-sky-500/60',
    rose: 'bg-rose-500/30 text-rose-200 border-rose-500/60',
    stone: 'bg-stone-500/30 text-stone-200 border-stone-500/60',
  };
  return (
    <span className={`rounded border px-1.5 py-0.5 font-bold ${colors[color]}`}>
      {children}
    </span>
  );
}

export function FlagBadge({
  color,
  children,
}: {
  color: 'amber' | 'sky' | 'rose';
  children: React.ReactNode;
}) {
  const colors = {
    amber: 'bg-amber-500/40 text-amber-100 border-amber-400',
    sky: 'bg-sky-500/40 text-sky-100 border-sky-400',
    rose: 'bg-rose-500/40 text-rose-100 border-rose-400',
  };
  return (
    <span className={`rounded border px-2 py-0.5 font-bold shadow-sm ${colors[color]}`}>
      {children}
    </span>
  );
}

const KIND_LABELS: Record<string, string> = {
  gwang: '광',
  yeol: '끗',
  ddi: '띠',
  pi: '피',
};
const KIND_COLORS: Record<string, string> = {
  gwang: 'bg-amber-500/20 text-amber-200 border-amber-500/50',
  yeol: 'bg-sky-500/20 text-sky-200 border-sky-500/50',
  ddi: 'bg-rose-500/20 text-rose-200 border-rose-500/50',
  pi: 'bg-stone-500/20 text-stone-200 border-stone-500/50',
};

export function CollectedGroups({
  collected,
  cardW,
}: {
  collected: readonly CardType[];
  cardW: number;
}) {
  const groups = {
    gwang: collected.filter((c) => c.kind === 'gwang'),
    yeol: collected.filter((c) => c.kind === 'yeol'),
    ddi: collected.filter((c) => c.kind === 'ddi'),
    pi: collected.filter((c) => c.kind === 'pi'),
  };
  return (
    <div className="flex flex-col gap-2">
      {(['gwang', 'yeol', 'ddi', 'pi'] as const).map((kind) =>
        groups[kind].length > 0 ? (
          <div key={kind} className="flex items-center gap-2">
            <span
              className={`flex-shrink-0 rounded border px-2 py-0.5 text-xs font-bold ${KIND_COLORS[kind]}`}
            >
              {KIND_LABELS[kind]} {groups[kind].length}
            </span>
            <div className="flex flex-wrap items-center -space-x-3">
              {groups[kind].map((c) => (
                <Card key={c.id} card={c} width={cardW} label={c.name} />
              ))}
            </div>
          </div>
        ) : null,
      )}
    </div>
  );
}
