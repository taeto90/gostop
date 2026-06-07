import type { Card } from '@gostop/shared';

/**
 * 딴패(collected) 광/끗/띠/피 분류 — MobileCollected/OpponentSlot/MyCollectedRow 공용.
 *
 * 9월 열끗(m09-yeol)을 쌍피로 사용 중(`nineYeolAsSsangPi`)이면 yeol에서 빼고
 * pi 그룹으로 시각 이동 (점수 계산 `calculateScore({nineYeolAsSsangPi})`와 동일 기준).
 */

export type CollectedKind = 'gwang' | 'yeol' | 'ddi' | 'pi';

export const COLLECTED_KINDS: readonly CollectedKind[] = ['gwang', 'yeol', 'ddi', 'pi'];

export const KIND_LABELS: Record<CollectedKind, string> = {
  gwang: '광',
  yeol: '끗',
  ddi: '띠',
  pi: '피',
};

/** 그룹 라벨 배지 색상 (Tailwind 클래스) */
export const KIND_COLORS: Record<CollectedKind, string> = {
  gwang: 'bg-amber-500/20 text-amber-200 border-amber-500/50',
  yeol: 'bg-sky-500/20 text-sky-200 border-sky-500/50',
  ddi: 'bg-rose-500/20 text-rose-200 border-rose-500/50',
  pi: 'bg-stone-500/20 text-stone-200 border-stone-500/50',
};

export function groupCollected(
  collected: readonly Card[],
  nineYeolAsSsangPi = false,
): Record<CollectedKind, Card[]> {
  const m09yeol = collected.find((c) => c.id === 'm09-yeol');
  return {
    gwang: collected.filter((c) => c.kind === 'gwang'),
    yeol: nineYeolAsSsangPi
      ? collected.filter((c) => c.kind === 'yeol' && c.id !== 'm09-yeol')
      : collected.filter((c) => c.kind === 'yeol'),
    ddi: collected.filter((c) => c.kind === 'ddi'),
    pi:
      nineYeolAsSsangPi && m09yeol
        ? [...collected.filter((c) => c.kind === 'pi'), m09yeol]
        : collected.filter((c) => c.kind === 'pi'),
  };
}
