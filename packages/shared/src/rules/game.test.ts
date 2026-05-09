import { describe, it, expect } from 'vitest';
import { createBombCard, createJokerCard, getCardById } from '../cards/deck.ts';
import { dealNewGame, executeTurn, isGameOver, nextTurnIndex } from './game.ts';
import type { Card } from '../types/card.ts';

const card = (id: string): Card => {
  const c = getCardById(id);
  if (!c) throw new Error(`Card ${id} not found`);
  return c;
};

// 결정적 RNG (시드 기반)
function makeRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

describe('dealNewGame', () => {
  it('2인이면 손패 10장×2 + 바닥 8장 + 더미 20장 (맞고 표준)', () => {
    const result = dealNewGame(['p1', 'p2']);
    expect(result.hands['p1']).toHaveLength(10);
    expect(result.hands['p2']).toHaveLength(10);
    expect(result.field).toHaveLength(8);
    expect(result.deck).toHaveLength(20);

    const total =
      result.hands['p1']!.length +
      result.hands['p2']!.length +
      result.field.length +
      result.deck.length;
    expect(total).toBe(48);
  });

  it('3인이면 손패 7장×3 + 바닥 6장 + 더미 21장', () => {
    const result = dealNewGame(['p1', 'p2', 'p3']);
    expect(result.hands['p1']).toHaveLength(7);
    expect(result.hands['p2']).toHaveLength(7);
    expect(result.hands['p3']).toHaveLength(7);
    expect(result.field).toHaveLength(6);
    expect(result.deck).toHaveLength(21);
  });

  it('1명이나 4명은 에러', () => {
    expect(() => dealNewGame(['p1'])).toThrow(/2~3인/);
    expect(() => dealNewGame(['p1', 'p2', 'p3', 'p4'])).toThrow(/2~3인/);
  });

  it('모든 카드 ID가 고유 (총 48개)', () => {
    const result = dealNewGame(['p1', 'p2']);
    const allIds = [
      ...result.hands['p1']!,
      ...result.hands['p2']!,
      ...result.field,
      ...result.deck,
    ].map((c) => c.id);
    expect(new Set(allIds).size).toBe(48);
  });

  it('동일 시드 → 동일 결과', () => {
    const a = dealNewGame(['p1', 'p2'], makeRng(123));
    const b = dealNewGame(['p1', 'p2'], makeRng(123));
    expect(a.hands['p1']!.map((c) => c.id)).toEqual(b.hands['p1']!.map((c) => c.id));
    expect(a.field.map((c) => c.id)).toEqual(b.field.map((c) => c.id));
  });
});

describe('executeTurn — 손패 매칭 없음 + 더미 매칭 없음', () => {
  it('손패는 바닥에 추가, 더미도 바닥에 추가', () => {
    const state = {
      hand: [card('m05-ddi')],
      collected: [],
      field: [card('m08-gwang')],
      deck: [card('m11-gwang')],
    };
    const result = executeTurn(state, 'm05-ddi');

    expect(result.newState.hand).toHaveLength(0);
    expect(result.newState.collected).toHaveLength(0);
    expect(result.newState.field.map((c) => c.id).sort()).toEqual([
      'm05-ddi',
      'm08-gwang',
      'm11-gwang',
    ]);
    expect(result.newState.deck).toHaveLength(0);

    expect(result.events).toHaveLength(2);
    expect(result.events[0]!.step).toBe('play-hand');
    expect(result.events[0]!.result).toBe('placed');
    expect(result.events[1]!.step).toBe('draw');
    expect(result.events[1]!.result).toBe('placed');
  });
});

describe('executeTurn — 손패 매칭 있음 + 더미 매칭 없음', () => {
  it('손패 카드와 바닥 카드를 가져감, 더미는 바닥에 추가', () => {
    const state = {
      hand: [card('m05-ddi')],
      collected: [],
      field: [card('m05-pi-1'), card('m08-gwang')],
      deck: [card('m11-gwang')],
    };
    const result = executeTurn(state, 'm05-ddi');

    expect(result.newState.collected.map((c) => c.id).sort()).toEqual([
      'm05-ddi',
      'm05-pi-1',
    ]);
    expect(result.newState.field.map((c) => c.id).sort()).toEqual(['m08-gwang', 'm11-gwang']);
    expect(result.events[0]!.result).toBe('matched');
    expect(result.events[1]!.result).toBe('placed');
  });
});

describe('executeTurn — 더미 매칭', () => {
  it('손패는 placed, 더미는 매칭 → 둘 가져감', () => {
    const state = {
      hand: [card('m07-ddi')],
      collected: [],
      field: [card('m11-gwang')],
      deck: [card('m11-pi-1')],
    };
    const result = executeTurn(state, 'm07-ddi');

    // m07-ddi → 매칭 없음 → 바닥
    // 더미에서 m11-pi-1 → m11-gwang과 매칭 → 둘 가져감
    expect(result.newState.collected.map((c) => c.id).sort()).toEqual([
      'm11-gwang',
      'm11-pi-1',
    ]);
    expect(result.newState.field.map((c) => c.id)).toEqual(['m07-ddi']);
  });
});

describe('executeTurn — 둘 다 매칭', () => {
  it('손패와 더미 모두 매칭 → 4장 가져감', () => {
    const state = {
      hand: [card('m05-ddi')],
      collected: [],
      field: [card('m05-pi-1'), card('m11-gwang')],
      deck: [card('m11-pi-1')],
    };
    const result = executeTurn(state, 'm05-ddi');

    expect(result.newState.collected).toHaveLength(4);
    expect(result.newState.collected.map((c) => c.id).sort()).toEqual([
      'm05-ddi',
      'm05-pi-1',
      'm11-gwang',
      'm11-pi-1',
    ]);
    expect(result.newState.field).toHaveLength(0);
  });
});

describe('executeTurn — 더미 비었음', () => {
  it('손패만 처리하고 종료 (더미 단계 스킵)', () => {
    const state = {
      hand: [card('m05-ddi')],
      collected: [],
      field: [card('m05-pi-1')],
      deck: [],
    };
    const result = executeTurn(state, 'm05-ddi');

    expect(result.events).toHaveLength(1); // play-hand만
    expect(result.events[0]!.step).toBe('play-hand');
    expect(result.newState.collected).toHaveLength(2);
    expect(result.newState.deck).toHaveLength(0);
  });
});

describe('executeTurn — 잘못된 입력', () => {
  it('손패에 없는 카드 ID는 에러', () => {
    const state = {
      hand: [card('m05-ddi')],
      collected: [],
      field: [],
      deck: [card('m11-gwang')],
    };
    expect(() => executeTurn(state, 'm08-gwang')).toThrow(/not in hand/);
  });
});

describe('isGameOver', () => {
  it('손패 모두 비었고 더미 비었으면 true', () => {
    expect(isGameOver([[], []], [])).toBe(true);
  });

  it('손패 1장 남았으면 false', () => {
    expect(isGameOver([[card('m01-gwang')], []], [])).toBe(false);
  });

  it('더미 남았으면 false', () => {
    expect(isGameOver([[], []], [card('m01-gwang')])).toBe(false);
  });
});

describe('nextTurnIndex', () => {
  it('순환', () => {
    expect(nextTurnIndex(0, 3)).toBe(1);
    expect(nextTurnIndex(1, 3)).toBe(2);
    expect(nextTurnIndex(2, 3)).toBe(0);
  });

  it('2인', () => {
    expect(nextTurnIndex(0, 2)).toBe(1);
    expect(nextTurnIndex(1, 2)).toBe(0);
  });
});

describe('executeTurn — 폭탄 카드 (보너스 카드)', () => {
  it('폭탄 카드 클릭 시 손패에서 제거되고 더미 1장만 뒤집힘 (매칭 없음)', () => {
    const bomb = createBombCard();
    const drawnCard = card('m05-yeol');
    const result = executeTurn(
      {
        hand: [card('m01-pi-1'), bomb],
        collected: [],
        field: [card('m03-pi-1'), card('m07-pi-1')],
        deck: [drawnCard, card('m02-pi-1')],
      },
      bomb.id,
      { allowSpecials: true },
    );

    // 폭탄 카드는 손패에서 제거됨
    expect(result.newState.hand.find((c) => c.isBomb)).toBeUndefined();
    expect(result.newState.hand).toHaveLength(1);
    expect(result.newState.hand[0]!.id).toBe('m01-pi-1');

    // 폭탄 카드 자체는 collected/field에 들어가지 않음
    expect(result.newState.collected.find((c) => c.isBomb)).toBeUndefined();
    expect(result.newState.field.find((c) => c.isBomb)).toBeUndefined();

    // 더미 1장 뒤집기 진행됨 (m05-yeol은 바닥에 매칭 없으니 placed)
    expect(result.newState.deck).toHaveLength(1);
    expect(result.newState.field).toContainEqual(drawnCard);
  });

  it('폭탄 카드 + 더미 매칭 → 매칭 카드만 collected', () => {
    const bomb = createBombCard();
    const result = executeTurn(
      {
        hand: [bomb],
        collected: [],
        field: [card('m05-yeol')],
        deck: [card('m05-ddi'), card('m02-pi-1')],
      },
      bomb.id,
      { allowSpecials: true },
    );

    // 더미에서 5월 ddi 뒤집기 → 바닥 5월 yeol과 매칭
    expect(result.newState.collected).toContainEqual(card('m05-yeol'));
    expect(result.newState.collected).toContainEqual(card('m05-ddi'));
    expect(result.newState.collected.find((c) => c.isBomb)).toBeUndefined();
    expect(result.newState.field).toHaveLength(0);
    // 싹쓸이 trigger
    expect(result.specials.sweep).toBe(true);
  });

  it('폭탄 카드는 폭탄 자동 발동 분기를 건너뜀 (같은 월 3장 체크 X)', () => {
    // 손패에 같은 월 3장이 있어도 isBomb 카드 클릭 시 폭탄 분기 X
    const bomb = createBombCard();
    const result = executeTurn(
      {
        hand: [
          card('m01-pi-1'),
          card('m01-pi-2'),
          card('m01-gwang'),
          bomb,
        ],
        collected: [],
        field: [card('m01-ddi'), card('m05-yeol')],
        deck: [card('m07-pi-1'), card('m02-pi-1')],
      },
      bomb.id,
      { allowSpecials: true },
    );

    expect(result.specials.bomb).toBeUndefined();
    expect(result.newState.hand).toHaveLength(3);
    expect(result.newState.hand.find((c) => c.isBomb)).toBeUndefined();
  });
});

describe('executeTurn — 조커 카드 (옵션 룰)', () => {
  it('조커 카드 클릭 시 손패에서 제거되고 collected에 쌍피 가치로 추가 + 더미 1장 뒤집기', () => {
    const joker = createJokerCard();
    const drawnCard = card('m05-yeol');
    const result = executeTurn(
      {
        hand: [joker, card('m01-pi-1')],
        collected: [],
        field: [card('m07-pi-1')],
        deck: [drawnCard, card('m02-pi-1')],
      },
      joker.id,
      { allowSpecials: true },
    );

    // 조커는 collected에 쌍피로 추가
    const collectedJoker = result.newState.collected.find((c) => c.isJoker);
    expect(collectedJoker).toBeDefined();
    expect(collectedJoker?.isSsangPi).toBe(true);

    // 손패에서 제거됨
    expect(result.newState.hand.find((c) => c.isJoker)).toBeUndefined();
    expect(result.newState.hand).toHaveLength(1);

    // 더미 1장 뒤집기 진행 (m05-yeol은 바닥 매칭 X — placed)
    expect(result.newState.deck).toHaveLength(1);
    expect(result.newState.field).toContainEqual(drawnCard);
  });

  it('조커는 같은 월 그룹 집계에서 제외 — 폭탄/흔들기 판정에 영향 X', () => {
    const joker = createJokerCard();
    const result = executeTurn(
      {
        hand: [
          card('m01-pi-1'),
          card('m01-pi-2'),
          card('m01-gwang'),
          joker,
        ],
        collected: [],
        field: [card('m01-ddi'), card('m05-yeol')],
        deck: [card('m07-pi-1')],
      },
      joker.id,
      { allowSpecials: true },
    );
    expect(result.specials.bomb).toBeUndefined();
  });
});

describe('dealNewGame — 조커 옵션', () => {
  it('jokerCount=2면 더미에 조커 2장 추가됨 (총 50장)', () => {
    const result = dealNewGame(['p1', 'p2', 'p3'], undefined, { jokerCount: 2 });
    const all = [
      ...result.hands['p1']!,
      ...result.hands['p2']!,
      ...result.hands['p3']!,
      ...result.field,
      ...result.deck,
    ];
    expect(all).toHaveLength(50); // 48 + 2
    expect(all.filter((c) => c.isJoker)).toHaveLength(2);
  });

  it('jokerCount=0이면 default DECK 그대로 (48장)', () => {
    const result = dealNewGame(['p1', 'p2', 'p3'], undefined, { jokerCount: 0 });
    const all = [
      ...result.hands['p1']!,
      ...result.hands['p2']!,
      ...result.hands['p3']!,
      ...result.field,
      ...result.deck,
    ];
    expect(all).toHaveLength(48);
    expect(all.filter((c) => c.isJoker)).toHaveLength(0);
  });
});

describe('executeTurn — 정통 룰 (Image #20 표 케이스)', () => {
  it('Case 1 (쪽): 바닥 0 + 손 1 + 더미 같은 월 → 둘 가져감 + jjok flag', () => {
    const state = {
      hand: [card('m05-yeol')],
      collected: [],
      field: [card('m07-pi-1')], // 같은 월 X
      deck: [card('m05-ddi')],
    };
    const result = executeTurn(state, 'm05-yeol', { allowSpecials: true });
    expect(result.specials.jjok).toBe(true);
    expect(result.newState.collected.map((c) => c.id).sort()).toEqual([
      'm05-ddi',
      'm05-yeol',
    ]);
  });

  it('Case 2 (그냥 먹기): 바닥 1 + 손 1 + 더미 다른 월 → 손패 매칭', () => {
    const state = {
      hand: [card('m05-yeol')],
      collected: [],
      field: [card('m05-ddi')],
      deck: [card('m07-pi-1')],
    };
    const result = executeTurn(state, 'm05-yeol', { allowSpecials: true });
    expect(result.specials.jjok).toBe(false);
    expect(result.specials.ttadak).toBe(false);
    expect(result.specials.ppeokMonth).toBeUndefined();
    expect(result.newState.collected.map((c) => c.id).sort()).toEqual([
      'm05-ddi',
      'm05-yeol',
    ]);
  });

  it('Case 3 (뻑): 바닥 1 + 손 1 + 더미 같은 월 → 3장 stuck', () => {
    const state = {
      hand: [card('m05-yeol')],
      collected: [],
      field: [card('m05-ddi')],
      deck: [card('m05-pi-1')],
    };
    const result = executeTurn(state, 'm05-yeol', { allowSpecials: true });
    expect(result.specials.ppeokMonth).toBe(5);
    expect(result.newState.collected).toHaveLength(0);
    // 같은 월 3장 모두 바닥에 stuck
    expect(
      result.newState.field.filter((c) => c.month === 5).map((c) => c.id).sort(),
    ).toEqual(['m05-ddi', 'm05-pi-1', 'm05-yeol']);
  });

  it('Case 4 (선택 매칭): 바닥 2 + 손 1 + 더미 다른 월 → 1장만 가져감', () => {
    const state = {
      hand: [card('m05-yeol')],
      collected: [],
      field: [card('m05-ddi'), card('m05-pi-1')],
      deck: [card('m07-pi-1')],
    };
    const result = executeTurn(state, 'm05-yeol', {
      allowSpecials: true,
      targetAfterHand: 'm05-ddi',
    });
    expect(result.specials.ppeokMonth).toBeUndefined();
    expect(result.newState.collected.map((c) => c.id).sort()).toEqual([
      'm05-ddi',
      'm05-yeol',
    ]);
    // 1장은 바닥에 남음
    expect(result.newState.field.find((c) => c.id === 'm05-pi-1')).toBeDefined();
  });

  it('Case 5 (따닥): 바닥 2 + 손 1 + 더미 같은 월 → 4장 모두', () => {
    const state = {
      hand: [card('m05-yeol')],
      collected: [],
      field: [card('m05-ddi'), card('m05-pi-1')],
      deck: [card('m05-pi-2')],
    };
    const result = executeTurn(state, 'm05-yeol', {
      allowSpecials: true,
      targetAfterHand: 'm05-ddi',
    });
    expect(result.specials.ttadak).toBe(true);
    expect(result.newState.collected).toHaveLength(4);
    expect(result.newState.field.filter((c) => c.month === 5)).toHaveLength(0);
  });

  it('Case 6 (뻑 회수): 바닥 3 (stuck) + 손 1 → 4장 모두', () => {
    const state = {
      hand: [card('m05-yeol')],
      collected: [],
      field: [card('m05-ddi'), card('m05-pi-1'), card('m05-pi-2')],
      deck: [card('m07-pi-1')],
    };
    const result = executeTurn(state, 'm05-yeol', {
      allowSpecials: true,
      stuckOwners: { 5: 'opponent' },
      myActorKey: 'me',
    });
    expect(result.specials.recoveredMonth).toBe(5);
    expect(result.specials.isOwnRecover).toBe(false);
    expect(result.newState.collected.filter((c) => c.month === 5)).toHaveLength(4);
  });
});
