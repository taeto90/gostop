import type { Card, Month } from '../types/card.ts';

/**
 * 바닥에서 주어진 카드와 같은 월 카드들을 반환.
 */
export function findMatches(field: readonly Card[], card: Card): Card[] {
  return field.filter((c) => c.month === card.month);
}

/**
 * 매칭 카드 종류가 서로 다른지 — 사용자 선택 모달 노출 여부 판정.
 *
 * 같은 종류 (피 2장 등)면 자동 선택해도 무방.
 * 다른 종류 (피+광, 광+띠 등)면 사용자가 어느 걸 가져갈지 선택해야 함.
 *
 * 종류 비교: kind + 특수 플래그(isSsangPi, isGoDori, isBigwang, ddiKind).
 * 두 장 이상이고 어느 두 카드라도 위 속성이 다르면 true.
 */
export function hasDifferentMatchKinds(matches: readonly Card[]): boolean {
  if (matches.length < 2) return false;
  const sigOf = (c: Card) =>
    `${c.kind}|${c.ddiKind ?? ''}|${c.isBigwang ? 1 : 0}|${c.isSsangPi ? 1 : 0}|${c.isGoDori ? 1 : 0}`;
  const first = sigOf(matches[0]!);
  return matches.some((c) => sigOf(c) !== first);
}

/**
 * 손패 중 바닥과 매칭되는 카드만 반환 (입문자 모드 하이라이트용).
 * 폭탄 카드는 매칭 X.
 */
export function getMatchableCardsFromHand(
  hand: readonly Card[],
  field: readonly Card[],
): Card[] {
  return hand.filter(
    (card) => !card.isBomb && !card.isJoker && findMatches(field, card).length > 0,
  );
}

/**
 * 같은 월 손패 N장 보유 여부 (흔들기/폭탄 판정용).
 * 폭탄 카드는 그룹 집계에서 제외.
 */
export function getSameMonthGroups(hand: readonly Card[]): Map<number, Card[]> {
  const groups = new Map<number, Card[]>();
  for (const card of hand) {
    if (card.isBomb || card.isJoker) continue;
    const arr = groups.get(card.month) ?? [];
    arr.push(card);
    groups.set(card.month, arr);
  }
  return groups;
}

/**
 * 흔들기 가능 여부 (같은 월 3장).
 */
export function canShake(hand: readonly Card[], month: number): boolean {
  const sameMonth = hand.filter((c) => !c.isBomb && !c.isJoker && c.month === month);
  return sameMonth.length === 3;
}

/**
 * 폭탄 가능 여부 (같은 월 4장).
 */
export function canBomb(hand: readonly Card[], month: number): boolean {
  const sameMonth = hand.filter((c) => !c.isBomb && !c.isJoker && c.month === month);
  return sameMonth.length === 4;
}

/**
 * 총통 (사패) — 게임 시작 직후 손패에 같은 월 4장이 있으면 즉시 승리.
 * 발견된 월 반환. 없으면 null. 통상 7점 처리 (rules-final.md).
 */
export function detectChongtong(hand: readonly Card[]): number | null {
  const groups = getSameMonthGroups(hand);
  for (const [month, cards] of groups) {
    if (cards.length === 4) return month;
  }
  return null;
}

/**
 * 게임 시작 시 손패 분석 — 흔들기(같은 월 3장) / 폭탄(4장) 후보 월.
 * AI 봇은 자동 적용 (shookMonths += [...], bombs += count). 사람은 모달로 사용자 선택.
 * 폭탄/조커 카드는 제외.
 */
export function detectShakesAndBombs(hand: readonly Card[]): {
  shakeMonths: Month[];
  bombMonths: Month[];
} {
  const groups = new Map<Month, Card[]>();
  for (const c of hand) {
    if (c.isBomb || c.isJoker) continue;
    const arr = groups.get(c.month) ?? [];
    arr.push(c);
    groups.set(c.month, arr);
  }
  const shakeMonths: Month[] = [];
  const bombMonths: Month[] = [];
  for (const [month, cards] of groups) {
    if (cards.length === 3) shakeMonths.push(month);
    else if (cards.length === 4) bombMonths.push(month);
  }
  return { shakeMonths, bombMonths };
}

/**
 * 카드 1장 내기 결과.
 *
 * Phase 1: 단순 룰만 (1매칭 또는 0매칭).
 * Phase 4: 뻑/자뻑 룰 추가 (allowPpeok 옵션).
 */
export interface PlayCardResult {
  /** 새 바닥 상태 */
  newField: Card[];
  /** 가져갈 카드 (빈 배열이면 매칭 없음 → 손패가 바닥으로 감) */
  collected: Card[];
  /** 여러 매칭이 있어 사용자 선택이 필요한 경우 후보 */
  needsTargetSelection?: Card[];
  /** 뻑 발생 (같은 월 3장 바닥에 stuck) — 그 월 */
  ppeokMonth?: number;
  /** 뻑 회수 (이전 뻑 같은 월 카드 가져감 = 자뻑 또는 회수) — 그 월 */
  ppeokRecoveredMonth?: number;
}

export interface PlayCardOptions {
  /** 매칭 카드가 여러 장일 때 어느 것을 가져갈지 (Phase 1 단순 모드) */
  targetCardId?: string;
  /** Phase 4 뻑/자뻑 룰 적용 */
  allowPpeok?: boolean;
}

/**
 * 카드 1장을 바닥에 내고 매칭 처리 (정통 룰, rules-final.md 표 기준).
 *
 * 매칭 카드 수에 따라:
 * - 0장: 바닥에 추가 (placed)
 * - 1장: 둘 다 가져감 (matched)
 * - 2장: **1장만 선택 매칭** (1장은 바닥에 남음). targetCardId 없으면 첫 번째
 *        — 사용자 선택 모달용 needsTargetSelection 반환
 * - 3장: **뻑 회수** (stuck 3장 + 본인 1장 = 4장 모두 collected)
 *
 * 뻑 발생(Case 3: 바닥 1 + 손 1 + 더미 같은 월)은 executeTurn에서 후처리.
 * 손패 단계에서는 그냥 1장 매칭으로 처리 후 더미 결과 보고 stuck 결정.
 */
export function playCard(
  card: Card,
  field: readonly Card[],
  optionsOrTargetId?: PlayCardOptions | string,
): PlayCardResult {
  const options: PlayCardOptions =
    typeof optionsOrTargetId === 'string'
      ? { targetCardId: optionsOrTargetId }
      : (optionsOrTargetId ?? {});

  const matches = findMatches(field, card);

  // 매칭 없음 → 카드가 바닥에 추가됨 (placed)
  if (matches.length === 0) {
    return {
      newField: [...field, card],
      collected: [],
    };
  }

  // 매칭 3장 → 뻑 회수 (Case 6: 바닥 3 + 손 1 → 4장 모두 가져감)
  if (options.allowPpeok && matches.length === 3) {
    return {
      newField: field.filter((c) => c.month !== card.month),
      collected: [card, ...matches],
      ppeokRecoveredMonth: card.month,
    };
  }

  // 매칭 1장 → 둘 다 가져감 (Case 2)
  if (matches.length === 1) {
    const matched = matches[0]!;
    return {
      newField: field.filter((c) => c.id !== matched.id),
      collected: [card, matched],
    };
  }

  // 매칭 2장 또는 그 이상 → 1장만 선택 매칭 (Case 4/5)
  // targetCardId로 사용자가 선택, 없으면 첫 번째 자동
  let target = matches[0]!;
  if (options.targetCardId !== undefined) {
    const found = matches.find((c) => c.id === options.targetCardId);
    if (!found) {
      throw new Error(
        `targetCardId "${options.targetCardId}" is not among matches: ${matches.map((c) => c.id).join(', ')}`,
      );
    }
    target = found;
  }

  return {
    newField: field.filter((c) => c.id !== target.id),
    collected: [card, target],
    needsTargetSelection:
      matches.length > 1 && options.targetCardId === undefined ? matches : undefined,
  };
}
