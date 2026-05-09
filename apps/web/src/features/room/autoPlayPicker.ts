import type { Card } from '@gostop/shared';

/**
 * 시간 초과 등으로 자동 카드 플레이가 필요할 때 카드 ID 선택.
 * 우선순위:
 *   1. 매칭 가능 카드 중 랜덤
 *   2. 일반 카드(폭탄/조커 제외) 중 랜덤
 *   3. 손패 전체에서 랜덤 (모두 폭탄/조커일 때)
 */
export function pickAutoPlayCardId(
  hand: readonly Card[],
  matchableIds: ReadonlySet<string>,
): string | null {
  if (hand.length === 0) return null;
  const matchable = hand.filter((c) => matchableIds.has(c.id));
  if (matchable.length > 0) {
    return matchable[Math.floor(Math.random() * matchable.length)]!.id;
  }
  const normal = hand.filter((c) => !c.isBomb && !c.isJoker);
  if (normal.length > 0) {
    return normal[Math.floor(Math.random() * normal.length)]!.id;
  }
  return hand[Math.floor(Math.random() * hand.length)]!.id;
}
