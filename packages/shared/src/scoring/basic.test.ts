import { describe, it, expect } from 'vitest';
import { getCardById } from '../cards/deck.ts';
import { calculateScore, canDeclareGoStop } from './basic.ts';
import type { Card } from '../types/card.ts';

const card = (id: string): Card => {
  const c = getCardById(id);
  if (!c) throw new Error(`Card ${id} not found`);
  return c;
};

describe('calculateScore — 광', () => {
  it('광 0~2장은 0점', () => {
    expect(calculateScore([]).gwang).toBe(0);
    expect(calculateScore([card('m01-gwang')]).gwang).toBe(0);
    expect(calculateScore([card('m01-gwang'), card('m03-gwang')]).gwang).toBe(0);
  });

  it('광 3장 = 3점 (비광 없음)', () => {
    expect(
      calculateScore([card('m01-gwang'), card('m03-gwang'), card('m08-gwang')]).gwang,
    ).toBe(3);
  });

  it('광 3장 (비광 포함) = 2점', () => {
    expect(
      calculateScore([card('m01-gwang'), card('m03-gwang'), card('m12-gwang')]).gwang,
    ).toBe(2);
  });

  it('광 4장 = 4점 (비광 없음)', () => {
    expect(
      calculateScore([
        card('m01-gwang'),
        card('m03-gwang'),
        card('m08-gwang'),
        card('m11-gwang'),
      ]).gwang,
    ).toBe(4);
  });

  it('광 4장 (비광 포함) = 2점', () => {
    expect(
      calculateScore([
        card('m01-gwang'),
        card('m03-gwang'),
        card('m08-gwang'),
        card('m12-gwang'),
      ]).gwang,
    ).toBe(2);
  });

  it('광 5장 = 15점 (비광 무관)', () => {
    expect(
      calculateScore([
        card('m01-gwang'),
        card('m03-gwang'),
        card('m08-gwang'),
        card('m11-gwang'),
        card('m12-gwang'),
      ]).gwang,
    ).toBe(15);
  });
});

describe('calculateScore — 열끗 / 고도리', () => {
  it('열끗 4장 이하는 0점', () => {
    const cards = [card('m05-yeol'), card('m06-yeol'), card('m07-yeol'), card('m09-yeol')];
    expect(calculateScore(cards).yeol).toBe(0);
  });

  it('열끗 5장 = 1점', () => {
    const cards = [
      card('m05-yeol'),
      card('m06-yeol'),
      card('m07-yeol'),
      card('m09-yeol'),
      card('m10-yeol'),
    ];
    expect(calculateScore(cards).yeol).toBe(1);
  });

  it('열끗 7장 = 3점', () => {
    const cards = [
      card('m05-yeol'),
      card('m06-yeol'),
      card('m07-yeol'),
      card('m09-yeol'),
      card('m10-yeol'),
      card('m02-yeol'), // 고도리 카운트지만 베이스에도 들어감
      card('m12-yeol'),
    ];
    expect(calculateScore(cards).yeol).toBe(3);
  });

  it('고도리 3장 = 5점 보너스', () => {
    const cards = [card('m02-yeol'), card('m04-yeol'), card('m08-yeol')];
    const result = calculateScore(cards);
    expect(result.godori).toBe(5);
    expect(result.yeol).toBe(0); // 베이스는 5장 미만이라 0
    expect(result.total).toBe(5);
  });

  it('고도리 2장은 보너스 없음', () => {
    const cards = [card('m02-yeol'), card('m04-yeol')];
    expect(calculateScore(cards).godori).toBe(0);
  });

  it('열끗 6장 + 고도리 3장 = 베이스 2점 + 고도리 5점 = 7점', () => {
    const cards = [
      card('m02-yeol'),
      card('m04-yeol'),
      card('m08-yeol'),
      card('m05-yeol'),
      card('m06-yeol'),
      card('m10-yeol'),
    ];
    const result = calculateScore(cards);
    expect(result.yeol).toBe(2);
    expect(result.godori).toBe(5);
    expect(result.total).toBe(7);
  });
});

describe('calculateScore — 띠 / 단', () => {
  it('띠 5장 = 1점', () => {
    const cards = [
      card('m01-ddi'),
      card('m04-ddi'),
      card('m05-ddi'),
      card('m06-ddi'),
      card('m12-ddi'),
    ];
    expect(calculateScore(cards).ddi).toBe(1);
  });

  it('홍단 3장 (모두 띠 포함) = 띠 0점 + 단 3점 = 3점', () => {
    const cards = [card('m01-ddi'), card('m02-ddi'), card('m03-ddi')];
    const result = calculateScore(cards);
    expect(result.ddi).toBe(0);
    expect(result.dan).toBe(3);
  });

  it('청단 3장 = 단 3점', () => {
    const cards = [card('m06-ddi'), card('m09-ddi'), card('m10-ddi')];
    expect(calculateScore(cards).dan).toBe(3);
  });

  it('초단 3장 = 단 3점', () => {
    const cards = [card('m04-ddi'), card('m05-ddi'), card('m07-ddi')];
    expect(calculateScore(cards).dan).toBe(3);
  });

  it('홍단 + 청단 모두 모음 = 단 6점', () => {
    const cards = [
      card('m01-ddi'),
      card('m02-ddi'),
      card('m03-ddi'),
      card('m06-ddi'),
      card('m09-ddi'),
      card('m10-ddi'),
    ];
    const result = calculateScore(cards);
    expect(result.dan).toBe(6);
    expect(result.ddi).toBe(2); // 6장이라 베이스 2점
  });

  it('비띠는 단 보너스에 안 들어감', () => {
    const cards = [card('m01-ddi'), card('m02-ddi'), card('m12-ddi')];
    expect(calculateScore(cards).dan).toBe(0); // 홍단 2장 + 비띠 1장 = 단 미완성
  });
});

describe('calculateScore — 피', () => {
  it('피 9장 이하 (쌍피 0) = 0점', () => {
    const cards = [
      card('m01-pi-1'),
      card('m02-pi-1'),
      card('m03-pi-1'),
      card('m04-pi-1'),
      card('m05-pi-1'),
    ];
    expect(calculateScore(cards).pi).toBe(0);
  });

  it('피 10장 = 1점', () => {
    const cards = [
      card('m01-pi-1'),
      card('m01-pi-2'),
      card('m02-pi-1'),
      card('m02-pi-2'),
      card('m03-pi-1'),
      card('m03-pi-2'),
      card('m04-pi-1'),
      card('m04-pi-2'),
      card('m05-pi-1'),
      card('m05-pi-2'),
    ];
    expect(calculateScore(cards).pi).toBe(1);
  });

  it('쌍피는 2장 가치 — 피 8장 + 쌍피 1장 = 가치 10 → 1점', () => {
    const cards = [
      card('m01-pi-1'),
      card('m01-pi-2'),
      card('m02-pi-1'),
      card('m02-pi-2'),
      card('m03-pi-1'),
      card('m03-pi-2'),
      card('m04-pi-1'),
      card('m04-pi-2'),
      card('m11-ssangpi'), // 가치 2
    ];
    expect(calculateScore(cards).pi).toBe(1);
  });

  it('피 11장 = 2점', () => {
    const cards = [
      card('m01-pi-1'),
      card('m01-pi-2'),
      card('m02-pi-1'),
      card('m02-pi-2'),
      card('m03-pi-1'),
      card('m03-pi-2'),
      card('m04-pi-1'),
      card('m04-pi-2'),
      card('m05-pi-1'),
      card('m05-pi-2'),
      card('m06-pi-1'),
    ];
    expect(calculateScore(cards).pi).toBe(2);
  });
});

describe('calculateScore — 종합', () => {
  it('빈 딴패 → 모두 0', () => {
    const result = calculateScore([]);
    expect(result.total).toBe(0);
  });

  it('복합 시나리오 — 광 3 + 고도리 + 단 + 피 → 정확히 합산', () => {
    const cards = [
      // 광 3장 (비광 없음) = 3
      card('m01-gwang'),
      card('m03-gwang'),
      card('m08-gwang'),
      // 고도리 3장 = 5
      card('m02-yeol'),
      card('m04-yeol'),
      card('m08-yeol'),
      // 홍단 3장 = 3 (띠 베이스 0)
      card('m01-ddi'),
      card('m02-ddi'),
      card('m03-ddi'),
      // 피 10장 = 1
      card('m01-pi-1'),
      card('m01-pi-2'),
      card('m02-pi-1'),
      card('m02-pi-2'),
      card('m03-pi-1'),
      card('m03-pi-2'),
      card('m04-pi-1'),
      card('m04-pi-2'),
      card('m05-pi-1'),
      card('m05-pi-2'),
    ];
    const result = calculateScore(cards);
    expect(result).toMatchObject({
      gwang: 3,
      yeol: 0,
      godori: 5,
      ddi: 0,
      dan: 3,
      pi: 1,
      total: 12,
    });
  });
});

describe('calculateScore — 9월 열끗 쌍피 변환 (옵션, rules-final.md §1-5)', () => {
  it('default(false): 9월 열끗은 끗으로 카운트', () => {
    const collected = [
      card('m02-yeol'),
      card('m04-yeol'),
      card('m08-yeol'),
      card('m09-yeol'),
      card('m10-yeol'),
    ];
    const score = calculateScore(collected);
    // 5장이라 yeol = 1점 (5장 기본). 고도리 3장 = 5점
    expect(score.yeol).toBe(1);
    expect(score.godori).toBe(5);
    expect(score.pi).toBe(0);
  });

  it('nineYeolAsSsangPi=true: 9월 열끗은 쌍피로 (yeol -1, pi 가치 +2)', () => {
    const collected = [
      card('m02-yeol'),
      card('m04-yeol'),
      card('m08-yeol'),
      card('m09-yeol'),
      card('m10-yeol'),
      // 피 8장 가치 (10에서 2 부족) — 쌍피 변환으로 10 도달 → 1점
      card('m01-pi-1'),
      card('m01-pi-2'),
      card('m02-pi-1'),
      card('m02-pi-2'),
      card('m03-pi-1'),
      card('m03-pi-2'),
      card('m04-pi-1'),
      card('m04-pi-2'),
    ];
    const score = calculateScore(collected, { nineYeolAsSsangPi: true });
    // yeol 4장 (m09-yeol 빠짐) → 0점. 쌍피 변환으로 피 가치 8 + 2 = 10 → 1점
    expect(score.yeol).toBe(0);
    expect(score.pi).toBe(1);
  });

  it('9월 열끗 없으면 옵션 무시', () => {
    const collected = [card('m02-yeol'), card('m04-yeol'), card('m08-yeol')];
    const a = calculateScore(collected);
    const b = calculateScore(collected, { nineYeolAsSsangPi: true });
    expect(a).toEqual(b);
  });
});

describe('canDeclareGoStop', () => {
  // 3인 (default): 3점부터 났음
  it('3인 default — 2점이면 false', () => {
    expect(canDeclareGoStop({ gwang: 0, yeol: 0, godori: 0, ddi: 1, dan: 0, pi: 1, total: 2 })).toBe(false);
  });

  it('3인 default — 정확히 3점이면 true', () => {
    expect(canDeclareGoStop({ gwang: 3, yeol: 0, godori: 0, ddi: 0, dan: 0, pi: 0, total: 3 })).toBe(true);
  });

  it('3인 default — 6점이면 true', () => {
    expect(canDeclareGoStop({ gwang: 3, yeol: 1, godori: 0, ddi: 1, dan: 0, pi: 1, total: 6 })).toBe(true);
  });

  // 2인 (맞고): 7점부터
  it('2인 맞고 — 6점이면 false', () => {
    expect(canDeclareGoStop({ gwang: 3, yeol: 1, godori: 0, ddi: 1, dan: 0, pi: 1, total: 6 }, 2)).toBe(false);
  });

  it('2인 맞고 — 정확히 7점이면 true', () => {
    expect(canDeclareGoStop({ gwang: 3, yeol: 0, godori: 0, ddi: 0, dan: 3, pi: 1, total: 7 }, 2)).toBe(true);
  });
});
