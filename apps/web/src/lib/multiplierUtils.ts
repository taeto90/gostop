import { calculateScore, type PlayerStateView } from '@gostop/shared';

export function computeMultiplier(p: PlayerStateView | undefined): number {
  if (!p) return 1;
  const shake = p.flags?.shookMonths?.length ?? 0;
  const goN = p.goCount ?? 0;
  const goMul = goN >= 3 ? 2 ** (goN - 2) : 1;
  return Math.max(1, 2 ** shake * goMul);
}

export function multiplierBreakdown(p: PlayerStateView | undefined): string {
  if (!p) return '';
  const shake = p.flags?.shookMonths?.length ?? 0;
  const goN = p.goCount ?? 0;
  const parts: string[] = [];
  if (shake > 0) {
    const months = (p.flags?.shookMonths as number[]).join(',');
    parts.push(`흔들기 ${months}월 (×${2 ** shake})`);
  }
  if (goN >= 3) parts.push(`${goN}고 (×${2 ** (goN - 2)})`);
  else if (goN > 0) parts.push(`${goN}고`);
  return parts.length > 0 ? parts.join(' · ') : '';
}

export function scoreBreakdown(
  p: PlayerStateView | undefined,
  allowGukJoon = true,
): string {
  if (!p) return '';
  const s = calculateScore(p.collected, {
    nineYeolAsSsangPi: p.flags?.nineYeolAsSsangPi ?? false,
    allowGukJoon,
  });
  const parts: string[] = [];
  if (s.gwang > 0) parts.push(`광 ${s.gwang}점`);
  if (s.godori > 0) parts.push(`고도리 ${s.godori}점`);
  if (s.yeol > 0) parts.push(`끗 ${s.yeol}점`);
  if (s.ddi > 0) parts.push(`띠 ${s.ddi}점`);
  if (s.dan > 0) parts.push(`단 ${s.dan}점`);
  if (s.pi > 0) parts.push(`피 ${s.pi}점`);

  const mul = computeMultiplier(p);
  const mulText = multiplierBreakdown(p);
  if (mul > 1 && mulText) parts.push(`배수: ${mulText}`);
  return parts.length > 0 ? parts.join('\n') : '아직 판에 없음';
}
