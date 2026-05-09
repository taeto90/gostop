import { describe, it, expect } from 'vitest';
import { getCardById } from '../cards/deck.ts';
import {
  findMatches,
  getMatchableCardsFromHand,
  getSameMonthGroups,
  canShake,
  canBomb,
  playCard,
} from './matching.ts';
import type { Card } from '../types/card.ts';

const card = (id: string): Card => {
  const c = getCardById(id);
  if (!c) throw new Error(`Card ${id} not found`);
  return c;
};

describe('findMatches', () => {
  it('바닥에서 같은 월 카드를 모두 찾는다', () => {
    const field = [card('m05-yeol'), card('m05-pi-1'), card('m08-gwang')];
    const matches = findMatches(field, card('m05-ddi'));
    expect(matches).toHaveLength(2);
    expect(matches.map((c) => c.id).sort()).toEqual(['m05-pi-1', 'm05-yeol']);
  });

  it('매칭 없으면 빈 배열을 반환한다', () => {
    const field = [card('m08-gwang')];
    expect(findMatches(field, card('m05-ddi'))).toHaveLength(0);
  });

  it('빈 바닥에서 빈 배열을 반환한다', () => {
    expect(findMatches([], card('m05-ddi'))).toHaveLength(0);
  });
});

describe('getMatchableCardsFromHand', () => {
  it('바닥과 매칭되는 손패만 반환한다', () => {
    const hand = [card('m01-pi-1'), card('m05-ddi'), card('m08-pi-1')];
    const field = [card('m05-yeol'), card('m08-gwang')];
    const matchable = getMatchableCardsFromHand(hand, field);
    expect(matchable.map((c) => c.id).sort()).toEqual(['m05-ddi', 'm08-pi-1']);
  });

  it('빈 바닥이면 매칭되는 손패 없음', () => {
    const hand = [card('m01-pi-1'), card('m05-ddi')];
    expect(getMatchableCardsFromHand(hand, [])).toHaveLength(0);
  });
});

describe('getSameMonthGroups', () => {
  it('월별로 카드를 그룹핑한다', () => {
    const hand = [card('m05-yeol'), card('m05-ddi'), card('m05-pi-1'), card('m08-gwang')];
    const groups = getSameMonthGroups(hand);
    expect(groups.get(5)).toHaveLength(3);
    expect(groups.get(8)).toHaveLength(1);
    expect(groups.has(1)).toBe(false);
  });
});

describe('canShake / canBomb', () => {
  it('같은 월 3장이면 흔들기 가능', () => {
    const hand = [card('m05-yeol'), card('m05-ddi'), card('m05-pi-1'), card('m08-gwang')];
    expect(canShake(hand, 5)).toBe(true);
    expect(canShake(hand, 8)).toBe(false);
  });

  it('같은 월 4장이면 폭탄 가능 (흔들기는 false)', () => {
    const hand = [
      card('m05-yeol'),
      card('m05-ddi'),
      card('m05-pi-1'),
      card('m05-pi-2'),
    ];
    expect(canBomb(hand, 5)).toBe(true);
    expect(canShake(hand, 5)).toBe(false); // 4장이면 폭탄, 3장이어야 흔들기
  });
});

describe('playCard — 매칭 없음', () => {
  it('바닥에 같은 월 카드가 없으면 바닥에 추가됨', () => {
    const field = [card('m08-gwang')];
    const result = playCard(card('m05-ddi'), field);
    expect(result.newField).toHaveLength(2);
    expect(result.newField.map((c) => c.id)).toContain('m05-ddi');
    expect(result.collected).toHaveLength(0);
  });

  it('빈 바닥이어도 카드만 추가됨', () => {
    const result = playCard(card('m05-ddi'), []);
    expect(result.newField).toEqual([card('m05-ddi')]);
    expect(result.collected).toHaveLength(0);
  });
});

describe('playCard — 매칭 1장', () => {
  it('내 카드와 바닥 카드를 둘 다 가져감', () => {
    const field = [card('m05-pi-1'), card('m08-gwang')];
    const result = playCard(card('m05-ddi'), field);
    expect(result.newField).toEqual([card('m08-gwang')]);
    expect(result.collected.map((c) => c.id).sort()).toEqual(['m05-ddi', 'm05-pi-1']);
  });
});

describe('playCard — 매칭 여러 장', () => {
  it('targetCardId 없으면 첫 번째 카드를 가져감 (Phase 1 단순화)', () => {
    const field = [card('m05-pi-1'), card('m05-pi-2'), card('m08-gwang')];
    const result = playCard(card('m05-ddi'), field);
    expect(result.collected).toHaveLength(2);
    expect(result.collected.map((c) => c.id)).toContain('m05-ddi');
    expect(result.needsTargetSelection?.length).toBe(2);
  });

  it('targetCardId 지정 시 해당 카드를 가져감', () => {
    const field = [card('m05-pi-1'), card('m05-pi-2'), card('m08-gwang')];
    const result = playCard(card('m05-ddi'), field, 'm05-pi-2');
    expect(result.collected.map((c) => c.id).sort()).toEqual(['m05-ddi', 'm05-pi-2']);
    expect(result.newField.map((c) => c.id).sort()).toEqual(['m05-pi-1', 'm08-gwang']);
  });

  it('잘못된 targetCardId면 에러', () => {
    const field = [card('m05-pi-1'), card('m05-pi-2')];
    expect(() => playCard(card('m05-ddi'), field, 'm08-gwang')).toThrow(/not among matches/);
  });
});
