import { describe, it, expect } from 'vitest';
import { getCardById } from '../cards/deck.ts';
import { chooseAiCard } from './simple.ts';
import type { Card } from '../types/card.ts';

const card = (id: string): Card => {
  const c = getCardById(id);
  if (!c) throw new Error(`Card ${id} not found`);
  return c;
};

describe('chooseAiCard', () => {
  it('매칭 가능한 카드 중 점수 변화 큰 것 우선 (광)', () => {
    const hand = [card('m05-pi-1'), card('m08-gwang'), card('m11-pi-1')];
    // 광 5장 모으면 15점이지만 1장 매칭만으론 0점
    // 8월 광 매칭하면 광1+피1, 11월 피1 매칭하면 광1+피1 (동일 점수)
    // 동일 점수면 광 우선
    const field = [card('m08-pi-1'), card('m11-gwang')];
    const chosen = chooseAiCard(hand, field, []);
    expect(chosen).toBe('m08-gwang');
  });

  it('매칭 가능한 카드 중 점수 변화 큰 것 우선 (광 모음 직전)', () => {
    // 이미 광 2장 보유 → 다음 광 매칭 시 광 3장 = 3점
    const collected = [card('m01-gwang'), card('m03-gwang')];
    const hand = [card('m05-pi-1'), card('m08-gwang'), card('m11-pi-1')];
    const field = [card('m08-pi-1'), card('m11-gwang')];
    const chosen = chooseAiCard(hand, field, collected);
    expect(chosen).toBe('m08-gwang'); // 광 3장 만들기
  });

  it('매칭 가능한 카드 중 열끗 > 띠 (동일 점수 시)', () => {
    const hand = [card('m05-pi-1'), card('m02-yeol'), card('m02-ddi')];
    const field = [card('m02-pi-1')];
    const chosen = chooseAiCard(hand, field, []);
    expect(chosen).toBe('m02-yeol');
  });

  it('매칭 없으면 피부터 버림', () => {
    const hand = [card('m08-gwang'), card('m05-pi-1'), card('m02-yeol')];
    const field = [card('m11-pi-1')];
    const chosen = chooseAiCard(hand, field, []);
    expect(chosen).toBe('m05-pi-1');
  });

  it('매칭 없을 때 같은 월 카드 다수면 그것부터 버림', () => {
    // 손패에 5월 2장 + 1월 1장. 둘 다 매칭 없음 (필드에 6월만)
    // 5월 카드는 어차피 다 못 가져갈 가능성 높으니 우선 버림
    const hand = [card('m01-pi-1'), card('m05-pi-1'), card('m05-pi-2')];
    const field = [card('m06-yeol')];
    const chosen = chooseAiCard(hand, field, []);
    expect(['m05-pi-1', 'm05-pi-2']).toContain(chosen);
  });

  it('빈 손이면 에러', () => {
    expect(() => chooseAiCard([], [])).toThrow();
  });

  it('easy 난이도는 매칭 가능 카드 중 하나 반환', () => {
    const hand = [card('m05-pi-1'), card('m08-gwang')];
    const field = [card('m08-pi-1')];
    const chosen = chooseAiCard(hand, field, [], 'easy');
    expect(['m05-pi-1', 'm08-gwang']).toContain(chosen);
  });

  it('hard 난이도 — 같은 월 3장 보유 시 매칭 시점에 보존', () => {
    // 5월 카드 3장 손패 (흔들기 잠재)
    const hand = [
      card('m05-yeol'),
      card('m05-ddi'),
      card('m05-pi-1'),
      card('m08-gwang'), // 매칭 가능
    ];
    const field = [card('m08-pi-1'), card('m05-pi-2')];
    // 5월 매칭하면 흔들기 가능성 사라짐 → 8월 광 매칭 우선
    const chosen = chooseAiCard(hand, field, [], 'hard');
    expect(chosen).toBe('m08-gwang');
  });
});
