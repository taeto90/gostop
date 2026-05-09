import type { Card } from '../types/card.ts';
import { getMatchableCardsFromHand, playCard } from '../rules/matching.ts';
import { calculateScore } from '../scoring/basic.ts';

export type AiDifficulty = 'easy' | 'medium' | 'hard';

/**
 * 난이도별 AI 카드 선택.
 */
export function chooseAiCard(
  hand: readonly Card[],
  field: readonly Card[],
  collected: readonly Card[] = [],
  difficulty: AiDifficulty = 'medium',
): string {
  if (hand.length === 0) {
    throw new Error('AI: hand is empty');
  }

  if (difficulty === 'easy') return chooseEasy(hand, field);
  if (difficulty === 'hard') return chooseHard(hand, field, collected);
  return chooseMedium(hand, field, collected);
}

/** 초급 — 무작위 선택 */
function chooseEasy(hand: readonly Card[], field: readonly Card[]): string {
  const matchable = getMatchableCardsFromHand(hand, field);
  const pool = matchable.length > 0 ? matchable : hand;
  return pool[Math.floor(Math.random() * pool.length)]!.id;
}

/** 중급 — 매칭 시 점수 변화 시뮬레이션, 광 우선 */
function chooseMedium(
  hand: readonly Card[],
  field: readonly Card[],
  collected: readonly Card[],
): string {
  const matchable = getMatchableCardsFromHand(hand, field);
  const kindPriority: Record<string, number> = { gwang: 0, yeol: 1, ddi: 2, pi: 3 };

  if (matchable.length > 0) {
    let bestId = matchable[0]!.id;
    let bestDelta = -Infinity;
    let bestKindRank = Infinity;

    for (const card of matchable) {
      const result = playCard(card, field);
      const before = calculateScore(collected);
      const after = calculateScore([...collected, ...result.collected]);
      const delta = after.total - before.total;
      const kindRank = kindPriority[card.kind] ?? 99;

      if (delta > bestDelta || (delta === bestDelta && kindRank < bestKindRank)) {
        bestDelta = delta;
        bestKindRank = kindRank;
        bestId = card.id;
      }
    }
    return bestId;
  }

  const monthCount = new Map<number, number>();
  for (const c of hand) monthCount.set(c.month, (monthCount.get(c.month) ?? 0) + 1);

  const dumpPriority: Record<string, number> = { pi: 0, ddi: 1, yeol: 2, gwang: 3 };
  const sorted = [...hand].sort((a, b) => {
    const monthDiff = (monthCount.get(b.month) ?? 1) - (monthCount.get(a.month) ?? 1);
    if (monthDiff !== 0) return monthDiff;
    return (dumpPriority[a.kind] ?? 99) - (dumpPriority[b.kind] ?? 99);
  });
  return sorted[0]!.id;
}

/** 카드 종류별 카운트 */
function countByKind(cards: readonly Card[]): {
  gwang: number;
  yeol: number;
  ddi: number;
  piValue: number;
} {
  let gwang = 0;
  let yeol = 0;
  let ddi = 0;
  let piValue = 0;
  for (const c of cards) {
    if (c.kind === 'gwang') gwang++;
    else if (c.kind === 'yeol') yeol++;
    else if (c.kind === 'ddi') ddi++;
    else if (c.kind === 'pi') piValue += c.isSsangPi ? 2 : 1;
  }
  return { gwang, yeol, ddi, piValue };
}

/**
 * 고급 — medium + 박 회피 + 흔들기 보존 + 점수 종합 분석.
 *
 * 가중치:
 * - 점수 변화 ×100
 * - 광 부족 (광박 회피) → 광 카드 매칭 시 +50
 * - 피 가치 부족 → 피 매칭 시 가져온 가치 ×5
 * - 열끗 부족 → 열끗 매칭 시 +20
 * - 같은 월 3장 보유 카드는 매칭 시 페널티 -50 (흔들기 보존)
 * - kind 우선 (광>끗>띠>피) → 작은 가산
 */
function chooseHard(
  hand: readonly Card[],
  field: readonly Card[],
  collected: readonly Card[],
): string {
  const matchable = getMatchableCardsFromHand(hand, field);
  const kindPriority: Record<string, number> = { gwang: 0, yeol: 1, ddi: 2, pi: 3 };

  const monthCountInHand = new Map<number, number>();
  for (const c of hand) monthCountInHand.set(c.month, (monthCountInHand.get(c.month) ?? 0) + 1);

  const myCounts = countByKind(collected);

  if (matchable.length > 0) {
    let bestId = matchable[0]!.id;
    let bestScore = -Infinity;

    for (const card of matchable) {
      const result = playCard(card, field);
      const before = calculateScore(collected);
      const after = calculateScore([...collected, ...result.collected]);
      const delta = after.total - before.total;
      const kindRank = kindPriority[card.kind] ?? 99;
      const sameMonth = monthCountInHand.get(card.month) ?? 1;

      // 박 회피 가중치
      const collectedAfter = countByKind(result.collected);
      let avoidanceBonus = 0;
      if (myCounts.gwang < 3 && collectedAfter.gwang > 0) avoidanceBonus += 50;
      if (myCounts.piValue < 10 && collectedAfter.piValue > 0) {
        avoidanceBonus += collectedAfter.piValue * 5;
      }
      if (myCounts.yeol < 5 && collectedAfter.yeol > 0) avoidanceBonus += 20;

      // 점수 종합
      const score =
        delta * 100 +
        avoidanceBonus +
        (10 - kindRank) -
        (sameMonth >= 3 ? 50 : 0); // 흔들기 보존

      if (score > bestScore) {
        bestScore = score;
        bestId = card.id;
      }
    }
    return bestId;
  }

  // 매칭 불가 시 dump
  const dumpPriority: Record<string, number> = { pi: 0, ddi: 1, yeol: 2, gwang: 3 };
  const sorted = [...hand].sort((a, b) => {
    const aCount = monthCountInHand.get(a.month) ?? 1;
    const bCount = monthCountInHand.get(b.month) ?? 1;

    const aPreserve = aCount >= 3 ? 1 : 0;
    const bPreserve = bCount >= 3 ? 1 : 0;
    if (aPreserve !== bPreserve) return aPreserve - bPreserve;

    if (bCount !== aCount) return bCount - aCount;
    return (dumpPriority[a.kind] ?? 99) - (dumpPriority[b.kind] ?? 99);
  });
  return sorted[0]!.id;
}
