import { describe, it, expect } from 'vitest';
import { getCardById } from '../cards/deck.ts';
import { calculateFinalScore } from './multipliers.ts';
import type { Card } from '../types/card.ts';

const card = (id: string): Card => {
  const c = getCardById(id);
  if (!c) throw new Error(`Card ${id} not found`);
  return c;
};

describe('calculateFinalScore - 박', () => {
  it('피박: 본인 피 10장 + 상대 피 5장 미만 → ×2', () => {
    // 본인 피 10장 (가치 10), 광은 의도적으로 적게 (광박 회피)
    const myCollected = [
      card('m01-pi-1'), card('m01-pi-2'),
      card('m02-pi-1'), card('m02-pi-2'),
      card('m03-pi-1'), card('m03-pi-2'),
      card('m04-pi-1'), card('m04-pi-2'),
      card('m05-pi-1'), card('m05-pi-2'),
    ];
    const opponent = [card('m06-pi-1'), card('m07-pi-1'), card('m08-gwang')]; // 상대 광 1장 (광박 회피)

    const result = calculateFinalScore(myCollected, [opponent], {
      goCount: 0,
      shookCount: 0,
      bombCount: 0,
    });

    expect(result.flags.pibak).toBe(true);
    expect(result.flags.gwangbak).toBe(false);
    expect(result.multiplier).toBe(2);
  });

  it('광박: 본인 광 3장 + 상대 광 0장 → ×2', () => {
    const myCollected = [card('m01-gwang'), card('m03-gwang'), card('m08-gwang')];
    const opponent = [card('m02-yeol'), card('m04-yeol')]; // 광 없음

    const result = calculateFinalScore(myCollected, [opponent], {
      goCount: 0,
      shookCount: 0,
      bombCount: 0,
    });

    expect(result.flags.gwangbak).toBe(true);
    expect(result.multiplier).toBe(2);
  });

  it('멍박: 본인 열끗 5장 + 상대 열끗 0장 → ×2', () => {
    const myCollected = [
      card('m02-yeol'), card('m04-yeol'), card('m05-yeol'),
      card('m06-yeol'), card('m07-yeol'),
    ];
    const opponent = [card('m01-pi-1'), card('m03-pi-1')];

    const result = calculateFinalScore(myCollected, [opponent], {
      goCount: 0,
      shookCount: 0,
      bombCount: 0,
    });

    expect(result.flags.myungbak).toBe(true);
    expect(result.multiplier).toBe(2);
  });

  it('피박+광박 동시: ×4', () => {
    const myCollected = [
      // 피박용 피 10
      card('m01-pi-1'), card('m01-pi-2'),
      card('m02-pi-1'), card('m02-pi-2'),
      card('m03-pi-1'), card('m03-pi-2'),
      card('m04-pi-1'), card('m04-pi-2'),
      card('m05-pi-1'), card('m05-pi-2'),
      // 광박용 광 3
      card('m01-gwang'), card('m03-gwang'), card('m08-gwang'),
    ];
    const opponent = [card('m06-pi-1')]; // 광 0, 피 1

    const result = calculateFinalScore(myCollected, [opponent], {
      goCount: 0,
      shookCount: 0,
      bombCount: 0,
    });

    expect(result.flags.pibak).toBe(true);
    expect(result.flags.gwangbak).toBe(true);
    expect(result.multiplier).toBe(4);
  });
});

describe('calculateFinalScore - 고 배수', () => {
  it('1고는 점수 그대로 (×1)', () => {
    const myCollected = [card('m01-gwang'), card('m03-gwang'), card('m08-gwang')];
    const opponent = [card('m02-yeol')]; // 광 0
    const result = calculateFinalScore(myCollected, [opponent], {
      goCount: 1,
      shookCount: 0,
      bombCount: 0,
    });
    // 광박 ×2 + 1고 ×1 = ×2
    expect(result.multiplier).toBe(2);
  });

  it('2고는 ×1 (점수 +2만, 배수는 1)', () => {
    const myCollected = [card('m01-gwang'), card('m03-gwang'), card('m08-gwang')];
    const opponent = [card('m02-pi-1')]; // 광 0 → 광박
    const result = calculateFinalScore(myCollected, [opponent], {
      goCount: 2,
      shookCount: 0,
      bombCount: 0,
    });
    // 광박 ×2만 (2고는 점수 +2만 추가, 배수 X)
    expect(result.multiplier).toBe(2);
    // bonusedTotal = base + goCount = 3 + 2 = 5, finalTotal = 5 × 2 = 10
    expect(result.bonusedTotal).toBe(5);
    expect(result.finalTotal).toBe(10);
  });

  it('3고는 ×2 누적 (점수 +3 × ×2)', () => {
    const myCollected = [card('m01-gwang'), card('m03-gwang'), card('m08-gwang')];
    const opponent = [card('m02-pi-1')];
    const result = calculateFinalScore(myCollected, [opponent], {
      goCount: 3,
      shookCount: 0,
      bombCount: 0,
    });
    // 광박 ×2 + 3고 ×2 = ×4. bonusedTotal = 3 + 3 = 6, finalTotal = 6 × 4 = 24
    expect(result.multiplier).toBe(4);
    expect(result.bonusedTotal).toBe(6);
    expect(result.finalTotal).toBe(24);
  });

  it('5고는 ×8 누적', () => {
    const myCollected = [card('m01-gwang'), card('m03-gwang'), card('m08-gwang')];
    const opponent = [card('m02-pi-1')];
    const result = calculateFinalScore(myCollected, [opponent], {
      goCount: 5,
      shookCount: 0,
      bombCount: 0,
    });
    // 광박 ×2 + 5고 ×8 = ×16
    expect(result.multiplier).toBe(16);
  });
});

describe('calculateFinalScore - 흔들기/폭탄', () => {
  it('흔들기 1번 ×2', () => {
    // 박 발동 안 되도록 단순한 collected
    const myCollected = [card('m02-pi-1'), card('m04-pi-1')];
    const opponent = [card('m01-pi-1'), card('m03-pi-1'), card('m08-gwang')];
    const result = calculateFinalScore(myCollected, [opponent], {
      goCount: 0,
      shookCount: 1,
      bombCount: 0,
    });
    // 흔들기 ×2만
    expect(result.multiplier).toBe(2);
  });

  it('폭탄 + 흔들기 동시', () => {
    const myCollected = [card('m01-gwang'), card('m03-gwang'), card('m08-gwang')];
    const opponent = [card('m02-pi-1')]; // 광 0
    const result = calculateFinalScore(myCollected, [opponent], {
      goCount: 0,
      shookCount: 1,
      bombCount: 1,
    });
    // 광박 ×2 + 흔들기 ×2 + 폭탄 ×2 = ×8
    expect(result.multiplier).toBe(8);
  });
});

describe('calculateFinalScore - 박 미적용', () => {
  it('상대 피 6장 이상이면 피박 X (5장은 피박 O)', () => {
    const myCollected = [
      card('m01-pi-1'), card('m01-pi-2'),
      card('m02-pi-1'), card('m02-pi-2'),
      card('m03-pi-1'), card('m03-pi-2'),
      card('m04-pi-1'), card('m04-pi-2'),
      card('m05-pi-1'), card('m05-pi-2'),
    ];
    const opponent = [
      card('m06-pi-1'), card('m06-pi-2'),
      card('m07-pi-1'), card('m07-pi-2'),
      card('m08-pi-1'), card('m08-pi-2'),
    ]; // 상대 피 6장 → 면제

    const result = calculateFinalScore(myCollected, [opponent], {
      goCount: 0,
      shookCount: 0,
      bombCount: 0,
    });

    expect(result.flags.pibak).toBe(false);
    expect(result.multiplier).toBe(1);
  });

  it('상대 피 0장이면 피박 면제 (rules-final.md)', () => {
    const myCollected = [
      card('m01-pi-1'), card('m01-pi-2'),
      card('m02-pi-1'), card('m02-pi-2'),
      card('m03-pi-1'), card('m03-pi-2'),
      card('m04-pi-1'), card('m04-pi-2'),
      card('m05-pi-1'), card('m05-pi-2'),
    ];
    const opponent = [card('m08-gwang')]; // 피 0장 → 면제

    const result = calculateFinalScore(myCollected, [opponent], {
      goCount: 0,
      shookCount: 0,
      bombCount: 0,
    });

    expect(result.flags.pibak).toBe(false);
  });
});

describe('calculateFinalScore - 멍따 (끗 7장 이상)', () => {
  it('끗 7장 모으면 멍따 ×2 (상대 무관)', () => {
    const myCollected = [
      card('m02-yeol'),
      card('m04-yeol'),
      card('m05-yeol'),
      card('m06-yeol'),
      card('m07-yeol'),
      card('m09-yeol'),
      card('m10-yeol'),
    ]; // 끗 7장
    const opponent = [card('m08-yeol')]; // 끗 1장 — 멍박 X

    const result = calculateFinalScore(myCollected, [opponent], {
      goCount: 0,
      shookCount: 0,
      bombCount: 0,
    });

    expect(result.flags.myungttadak).toBe(true);
    expect(result.flags.myungbak).toBe(false);
    expect(result.multiplier).toBe(2);
  });

  it('끗 7장 + 상대 끗 0장 = 멍박 + 멍따 ×4', () => {
    const myCollected = [
      card('m02-yeol'),
      card('m04-yeol'),
      card('m05-yeol'),
      card('m06-yeol'),
      card('m07-yeol'),
      card('m09-yeol'),
      card('m10-yeol'),
    ];
    const opponent = [card('m01-pi-1')]; // 끗 0장

    const result = calculateFinalScore(myCollected, [opponent], {
      goCount: 0,
      shookCount: 0,
      bombCount: 0,
    });

    expect(result.flags.myungttadak).toBe(true);
    expect(result.flags.myungbak).toBe(true);
    expect(result.multiplier).toBe(4);
  });
});
