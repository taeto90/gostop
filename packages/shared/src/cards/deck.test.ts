import { describe, it, expect } from 'vitest';
import { DECK, createShuffledDeck, getCardById } from './deck.ts';

describe('DECK', () => {
  it('정확히 48장이다', () => {
    expect(DECK).toHaveLength(48);
  });

  it('모든 카드 ID가 고유하다', () => {
    const ids = new Set(DECK.map((c) => c.id));
    expect(ids.size).toBe(48);
  });

  it('각 월(1-12)마다 정확히 4장이다', () => {
    for (let month = 1; month <= 12; month++) {
      const monthCards = DECK.filter((c) => c.month === month);
      expect(monthCards, `${month}월`).toHaveLength(4);
    }
  });

  it('광은 5장이다 (1·3·8·11·12월)', () => {
    const gwang = DECK.filter((c) => c.kind === 'gwang');
    expect(gwang).toHaveLength(5);
    expect(gwang.map((c) => c.month).sort((a, b) => a - b)).toEqual([1, 3, 8, 11, 12]);
  });

  it('비광은 12월 광 1장이다', () => {
    const bigwang = DECK.filter((c) => c.isBigwang);
    expect(bigwang).toHaveLength(1);
    expect(bigwang[0]!.month).toBe(12);
    expect(bigwang[0]!.kind).toBe('gwang');
  });

  it('열끗은 9장이다', () => {
    const yeol = DECK.filter((c) => c.kind === 'yeol');
    expect(yeol).toHaveLength(9);
  });

  it('고도리는 2·4·8월 열끗 3장이다', () => {
    const godori = DECK.filter((c) => c.isGoDori);
    expect(godori).toHaveLength(3);
    expect(godori.map((c) => c.month).sort((a, b) => a - b)).toEqual([2, 4, 8]);
    expect(godori.every((c) => c.kind === 'yeol')).toBe(true);
  });

  it('띠는 10장이다', () => {
    const ddi = DECK.filter((c) => c.kind === 'ddi');
    expect(ddi).toHaveLength(10);
  });

  it('홍단은 3장이다 (1·2·3월)', () => {
    const hong = DECK.filter((c) => c.kind === 'ddi' && c.ddiKind === 'hong');
    expect(hong).toHaveLength(3);
    expect(hong.map((c) => c.month).sort((a, b) => a - b)).toEqual([1, 2, 3]);
  });

  it('청단은 3장이다 (6·9·10월)', () => {
    const cheong = DECK.filter((c) => c.kind === 'ddi' && c.ddiKind === 'cheong');
    expect(cheong).toHaveLength(3);
    expect(cheong.map((c) => c.month).sort((a, b) => a - b)).toEqual([6, 9, 10]);
  });

  it('초단은 3장이다 (4·5·7월)', () => {
    const cho = DECK.filter((c) => c.kind === 'ddi' && c.ddiKind === 'cho');
    expect(cho).toHaveLength(3);
    expect(cho.map((c) => c.month).sort((a, b) => a - b)).toEqual([4, 5, 7]);
  });

  it('피는 24장이다 (일반 21 + 쌍피 3)', () => {
    const pi = DECK.filter((c) => c.kind === 'pi');
    expect(pi).toHaveLength(24);
    const ssangpi = pi.filter((c) => c.isSsangPi);
    expect(ssangpi).toHaveLength(3);
    expect(ssangpi.map((c) => c.month).sort((a, b) => a - b)).toEqual([9, 11, 12]);
  });
});

describe('createShuffledDeck', () => {
  it('48장을 그대로 반환하고 원본을 변경하지 않는다', () => {
    const shuffled = createShuffledDeck();
    expect(shuffled).toHaveLength(48);
    expect(DECK).toHaveLength(48); // 원본 보존
  });

  it('동일한 RNG로 동일한 결과를 만든다 (시드 결정성)', () => {
    let seed = 42;
    const rng = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    const a = createShuffledDeck(rng);
    seed = 42;
    const b = createShuffledDeck(rng);
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
  });

  it('실제로 셔플된다 (DECK 순서와 다름)', () => {
    const shuffled = createShuffledDeck();
    const original = DECK.map((c) => c.id).join(',');
    const shuffledIds = shuffled.map((c) => c.id).join(',');
    // 무한히 같은 순서일 확률은 1/48! ≈ 0
    expect(shuffledIds).not.toBe(original);
  });
});

describe('getCardById', () => {
  it('존재하는 카드를 찾는다', () => {
    const card = getCardById('m12-gwang');
    expect(card?.month).toBe(12);
    expect(card?.kind).toBe('gwang');
    expect(card?.isBigwang).toBe(true);
  });

  it('없는 카드는 undefined를 반환한다', () => {
    expect(getCardById('m99-fake')).toBeUndefined();
  });
});
