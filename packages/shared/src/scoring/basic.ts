import type { Card } from '../types/card.ts';

/**
 * 점수 분해 (UI에서 분해 표시용 — Tier 1 기능).
 */
export interface ScoreBreakdown {
  /** 광 점수 (3광=3, 4광=4, 5광=15, 비광 포함 시 -1) */
  gwang: number;
  /** 열끗 베이스 점수 (5장 1점, 추가 +1점 per 장) */
  yeol: number;
  /** 고도리 보너스 (3장 모음 시 5점) */
  godori: number;
  /** 띠 베이스 점수 (5장 1점, 추가 +1점 per 장) */
  ddi: number;
  /** 단 보너스 (홍단/청단/초단 각 3장 모음 시 3점) */
  dan: number;
  /** 피 점수 (10장 1점, 추가 +1점 per 장. 쌍피=2장 가치) */
  pi: number;
  /** 합계 */
  total: number;
}

const ZERO: ScoreBreakdown = {
  gwang: 0,
  yeol: 0,
  godori: 0,
  ddi: 0,
  dan: 0,
  pi: 0,
  total: 0,
};

export interface ScoreOptions {
  /**
   * true면 9월 열끗 카드(`m09-yeol`)를 끗이 아닌 쌍피로 카운트 (rules-final.md §1-5 옵션).
   * 본인이 봉인 전까지 자유 토글 가능. 변환 시 yeol 1장 빠지고 pi value +2.
   */
  nineYeolAsSsangPi?: boolean;
  /**
   * 국준(9월 쌍피, `m09-ssangpi`) 인정 여부.
   * default true (쌍피 가치). false면 일반 피 1장 가치로 카운트.
   */
  allowGukJoon?: boolean;
}

/**
 * 한 플레이어의 딴패(collected)로 점수 계산.
 * 표준 룰만 (Phase 1). 박/고/흔들기 배수는 Phase 4에서 별도 적용.
 */
export function calculateScore(
  collected: readonly Card[],
  options: ScoreOptions = {},
): ScoreBreakdown {
  if (collected.length === 0) return { ...ZERO };

  const gwangCards = collected.filter((c) => c.kind === 'gwang');
  let yeolCards = collected.filter((c) => c.kind === 'yeol');
  const ddiCards = collected.filter((c) => c.kind === 'ddi');
  let piCards = collected.filter((c) => c.kind === 'pi');

  // 9월 열끗 → 쌍피 변환 (옵션, rules-final.md §1-5)
  if (options.nineYeolAsSsangPi) {
    const nineYeol = yeolCards.find((c) => c.id === 'm09-yeol');
    if (nineYeol) {
      yeolCards = yeolCards.filter((c) => c.id !== 'm09-yeol');
      // 쌍피로 카운트 — pi 카운트에 가치 2 추가 (실제 카드는 그대로지만 점수 산정만)
      piCards = [...piCards, { ...nineYeol, kind: 'pi', isSsangPi: true }];
    }
  }

  // 광 점수
  let gwang = 0;
  const hasBigwang = gwangCards.some((c) => c.isBigwang);
  const gwangCount = gwangCards.length;
  if (gwangCount === 5) gwang = 15;
  else if (gwangCount === 4) gwang = hasBigwang ? 2 : 4;
  else if (gwangCount === 3) gwang = hasBigwang ? 2 : 3;
  // 광 2장 이하는 0점

  // 열끗 점수
  const yeol = yeolCards.length >= 5 ? 1 + (yeolCards.length - 5) : 0;
  const godoriCount = yeolCards.filter((c) => c.isGoDori).length;
  const godori = godoriCount === 3 ? 5 : 0;

  // 띠 점수
  const ddi = ddiCards.length >= 5 ? 1 + (ddiCards.length - 5) : 0;
  const hongCount = ddiCards.filter((c) => c.ddiKind === 'hong').length;
  const cheongCount = ddiCards.filter((c) => c.ddiKind === 'cheong').length;
  const choCount = ddiCards.filter((c) => c.ddiKind === 'cho').length;
  let dan = 0;
  if (hongCount >= 3) dan += 3;
  if (cheongCount >= 3) dan += 3;
  if (choCount >= 3) dan += 3;

  // 피 점수 (쌍피는 2장 가치). 국준(m09-ssangpi)은 옵션 — false면 일반 피 1장
  const allowGukJoon = options.allowGukJoon ?? true;
  const piValue = piCards.reduce((sum, c) => {
    if (!c.isSsangPi) return sum + 1;
    if (c.id === 'm09-ssangpi' && !allowGukJoon) return sum + 1;
    return sum + 2;
  }, 0);
  const pi = piValue >= 10 ? 1 + (piValue - 10) : 0;

  const total = gwang + yeol + godori + ddi + dan + pi;
  return { gwang, yeol, godori, ddi, dan, pi, total };
}

/**
 * 점수 도달 시 고/스톱 결정 가능 (rules-final.md):
 *   2인 (맞고): 7점부터
 *   3인:        3점부터
 *   호스트가 방 룰에서 winScore override 가능 (3/5/7)
 */
export function canDeclareGoStop(
  breakdown: ScoreBreakdown,
  playerCount: number = 3,
  winScoreOverride?: 3 | 5 | 7,
): boolean {
  const threshold = winScoreOverride ?? (playerCount === 2 ? 7 : 3);
  return breakdown.total >= threshold;
}
