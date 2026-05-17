import type { PlayerStateView } from '@gostop/shared';

/**
 * 게임 진행 중 누적 배수 계산 — `packages/shared/src/scoring/multipliers.ts`와 동일 공식.
 *
 * 박(피박/광박/멍박)은 종료 시점 결정이라 게임 중 누적 X (결과 화면에서 처리).
 *   - 흔들기: 각 ×2 누적
 *   - 폭탄: 배수 X (rules-final.md §4 — 2026-05-17 개정). 보너스 카드 + 피 빼앗기만 효과
 *   - 고: 1·2고 ×1, 3고 ×2, 4고 ×4, 5고 ×8 ... (2^(goCount-2))
 */
export function computeMultiplier(p: PlayerStateView | undefined): number {
  if (!p) return 1;
  const shake = p.flags?.shookMonths?.length ?? 0;
  const goN = p.goCount ?? 0;
  const goMul = goN >= 3 ? 2 ** (goN - 2) : 1;
  return Math.max(1, 2 ** shake * goMul);
}

/** 배수 hover tooltip 분해 텍스트 */
export function multiplierBreakdown(p: PlayerStateView | undefined): string {
  const shake = p?.flags?.shookMonths?.length ?? 0;
  const goN = p?.goCount ?? 0;
  return `흔들기 ${shake} × 고 ${goN}`;
}
