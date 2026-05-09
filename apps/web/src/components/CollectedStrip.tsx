import type { Card as CardType } from '@gostop/shared';
import { Card } from './Card.tsx';

interface CollectedStripProps {
  collected: CardType[];
  size?: 'xs' | 'sm' | 'md';
  /** 펼친 정도 — compact는 카드 겹침 */
  density?: 'compact' | 'normal';
}

/**
 * 딴패를 광/끗/띠/피 별로 그룹지어 작게 가로로 표시.
 */
export function CollectedStrip({ collected, size = 'sm', density = 'normal' }: CollectedStripProps) {
  const groups = {
    gwang: collected.filter((c) => c.kind === 'gwang'),
    yeol: collected.filter((c) => c.kind === 'yeol'),
    ddi: collected.filter((c) => c.kind === 'ddi'),
    pi: collected.filter((c) => c.kind === 'pi'),
  };

  if (collected.length === 0) {
    return <div className="text-[10px] italic text-felt-300/50">아직 딴패 없음</div>;
  }

  return (
    <div className="flex flex-wrap items-start gap-2">
      {(['gwang', 'yeol', 'ddi', 'pi'] as const).map((kind) =>
        groups[kind].length > 0 ? (
          <div key={kind} className="flex items-center gap-1">
            <KindLabel kind={kind} count={groups[kind].length} />
            <div className={density === 'compact' ? 'flex -space-x-3' : 'flex -space-x-2'}>
              {groups[kind].map((c) => (
                <Card key={c.id} card={c} size={size} layoutId={c.id} />
              ))}
            </div>
          </div>
        ) : null,
      )}
    </div>
  );
}

function KindLabel({ kind, count }: { kind: 'gwang' | 'yeol' | 'ddi' | 'pi'; count: number }) {
  const labels = { gwang: '광', yeol: '끗', ddi: '띠', pi: '피' };
  const colors = {
    gwang: 'bg-amber-500/30 text-amber-200 border-amber-500/60',
    yeol: 'bg-sky-500/30 text-sky-200 border-sky-500/60',
    ddi: 'bg-rose-500/30 text-rose-200 border-rose-500/60',
    pi: 'bg-stone-500/30 text-stone-200 border-stone-500/60',
  };
  return (
    <span
      className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${colors[kind]}`}
    >
      {labels[kind]} {count}
    </span>
  );
}
