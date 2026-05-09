/**
 * 정통 4-3-3 분배 시각화 stagger 패턴.
 *
 * - 3인 (손패 7장 / 바닥 6장): 4장 → 바닥 3장 → 3장 → 바닥 3장
 * - 2인 (손패 10장 / 바닥 8장): 5장 → 바닥 4장 → 5장 → 바닥 4장
 *
 * 본인 손패 + 바닥에 적용. 다른 player 손패는 face-down이라 시각화 X.
 */

const ROUND_GAP = 0.45; // 라운드 사이 wait
const PER_CARD = 0.05;

/** 손패 카드별 분배 delay (초). i=0부터 시작 */
export function handDealDelay(i: number, total: number): number {
  if (total === 7) {
    // 3인: 첫 4장 → 바닥 3장 (시각화 안 됨) → 다음 3장
    if (i < 4) return i * PER_CARD;
    return ROUND_GAP * 2 + (i - 4) * PER_CARD;
  }
  if (total === 10) {
    // 2인: 첫 5장 → 바닥 4장 → 다음 5장
    if (i < 5) return i * PER_CARD;
    return ROUND_GAP * 2 + (i - 5) * PER_CARD;
  }
  // 기타: 그냥 stagger
  return i * PER_CARD;
}

/** 바닥 카드별 분배 delay (초). i=0부터 시작 */
export function fieldDealDelay(i: number, total: number): number {
  if (total === 6) {
    // 3인: 라운드 1 끝나고 바닥 3장 → 라운드 2 끝나고 3장 더
    if (i < 3) return ROUND_GAP + i * PER_CARD;
    return ROUND_GAP * 3 + (i - 3) * PER_CARD;
  }
  if (total === 8) {
    // 2인: 라운드 1 끝나고 4장 → 라운드 2 끝나고 4장
    if (i < 4) return ROUND_GAP + i * PER_CARD;
    return ROUND_GAP * 3 + (i - 4) * PER_CARD;
  }
  return i * PER_CARD;
}

/** 분배 시각화가 끝나는 총 시간 (초) — dealing phase 동기화용 */
export function totalDealDuration(handTotal: number): number {
  return handDealDelay(handTotal - 1, handTotal) + 0.2;
}
