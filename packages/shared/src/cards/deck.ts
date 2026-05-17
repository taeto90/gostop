import type { Card } from '../types/card.ts';

export const DECK: readonly Card[] = [
  // 1월 — 송학 (Pine & Crane)
  { id: 'm01-gwang', month: 1, kind: 'gwang', name: '송학광' },
  { id: 'm01-ddi', month: 1, kind: 'ddi', ddiKind: 'hong', name: '송학 홍단' },
  { id: 'm01-pi-1', month: 1, kind: 'pi', name: '송학 피1' },
  { id: 'm01-pi-2', month: 1, kind: 'pi', name: '송학 피2' },

  // 2월 — 매조 (Plum & Bush warbler)
  { id: 'm02-yeol', month: 2, kind: 'yeol', isGoDori: true, name: '매조 (고도리)' },
  { id: 'm02-ddi', month: 2, kind: 'ddi', ddiKind: 'hong', name: '매조 홍단' },
  { id: 'm02-pi-1', month: 2, kind: 'pi', name: '매조 피1' },
  { id: 'm02-pi-2', month: 2, kind: 'pi', name: '매조 피2' },

  // 3월 — 벚꽃 (Cherry blossom)
  { id: 'm03-gwang', month: 3, kind: 'gwang', name: '벚꽃광' },
  { id: 'm03-ddi', month: 3, kind: 'ddi', ddiKind: 'hong', name: '벚꽃 홍단' },
  { id: 'm03-pi-1', month: 3, kind: 'pi', name: '벚꽃 피1' },
  { id: 'm03-pi-2', month: 3, kind: 'pi', name: '벚꽃 피2' },

  // 4월 — 흑싸리 (Black bush clover & Cuckoo)
  { id: 'm04-yeol', month: 4, kind: 'yeol', isGoDori: true, name: '흑싸리 (고도리)' },
  { id: 'm04-ddi', month: 4, kind: 'ddi', ddiKind: 'cho', name: '흑싸리 초단' },
  { id: 'm04-pi-1', month: 4, kind: 'pi', name: '흑싸리 피1' },
  { id: 'm04-pi-2', month: 4, kind: 'pi', name: '흑싸리 피2' },

  // 5월 — 난초 (Iris)
  { id: 'm05-yeol', month: 5, kind: 'yeol', name: '난초 열끗' },
  { id: 'm05-ddi', month: 5, kind: 'ddi', ddiKind: 'cho', name: '난초 초단' },
  { id: 'm05-pi-1', month: 5, kind: 'pi', name: '난초 피1' },
  { id: 'm05-pi-2', month: 5, kind: 'pi', name: '난초 피2' },

  // 6월 — 모란 (Peony & Butterfly)
  { id: 'm06-yeol', month: 6, kind: 'yeol', name: '모란 (나비)' },
  { id: 'm06-ddi', month: 6, kind: 'ddi', ddiKind: 'cheong', name: '모란 청단' },
  { id: 'm06-pi-1', month: 6, kind: 'pi', name: '모란 피1' },
  { id: 'm06-pi-2', month: 6, kind: 'pi', name: '모란 피2' },

  // 7월 — 홍싸리 (Red bush clover & Boar)
  { id: 'm07-yeol', month: 7, kind: 'yeol', name: '홍싸리 (멧돼지)' },
  { id: 'm07-ddi', month: 7, kind: 'ddi', ddiKind: 'cho', name: '홍싸리 초단' },
  { id: 'm07-pi-1', month: 7, kind: 'pi', name: '홍싸리 피1' },
  { id: 'm07-pi-2', month: 7, kind: 'pi', name: '홍싸리 피2' },

  // 8월 — 공산 (Pampas grass & Moon & Geese)
  { id: 'm08-gwang', month: 8, kind: 'gwang', name: '공산광 (보름달)' },
  { id: 'm08-yeol', month: 8, kind: 'yeol', isGoDori: true, name: '공산 (기러기, 고도리)' },
  { id: 'm08-pi-1', month: 8, kind: 'pi', name: '공산 피1' },
  { id: 'm08-pi-2', month: 8, kind: 'pi', name: '공산 피2' },

  // 9월 — 국화 (Chrysanthemum)
  { id: 'm09-yeol', month: 9, kind: 'yeol', name: '국화 열끗' },
  { id: 'm09-ddi', month: 9, kind: 'ddi', ddiKind: 'cheong', name: '국화 청단' },
  // 9월 정통 한국 룰: 끗(m09-yeol)이 쌍피 역할 (옵션 nineYeolAsSsangPi).
  // 별도 쌍피 카드 없음 → m09-ssangpi는 일반 피 한 장 (legacy ID 유지).
  { id: 'm09-ssangpi', month: 9, kind: 'pi', name: '국화 피2' },
  { id: 'm09-pi', month: 9, kind: 'pi', name: '국화 피1' },

  // 10월 — 단풍 (Maple & Deer)
  { id: 'm10-yeol', month: 10, kind: 'yeol', name: '단풍 (사슴)' },
  { id: 'm10-ddi', month: 10, kind: 'ddi', ddiKind: 'cheong', name: '단풍 청단' },
  { id: 'm10-pi-1', month: 10, kind: 'pi', name: '단풍 피1' },
  { id: 'm10-pi-2', month: 10, kind: 'pi', name: '단풍 피2' },

  // 11월 — 오동 (Paulownia)
  { id: 'm11-gwang', month: 11, kind: 'gwang', name: '오동광' },
  { id: 'm11-pi-1', month: 11, kind: 'pi', name: '오동 피1' },
  { id: 'm11-pi-2', month: 11, kind: 'pi', name: '오동 피2' },
  { id: 'm11-ssangpi', month: 11, kind: 'pi', isSsangPi: true, name: '오동 쌍피' },

  // 12월 — 비 (Rain & Swallow & Bigwang)
  { id: 'm12-gwang', month: 12, kind: 'gwang', isBigwang: true, name: '비광' },
  { id: 'm12-yeol', month: 12, kind: 'yeol', name: '비 열끗 (제비)' },
  { id: 'm12-ddi', month: 12, kind: 'ddi', ddiKind: 'bi', name: '비띠' },
  { id: 'm12-ssangpi', month: 12, kind: 'pi', isSsangPi: true, name: '비 쌍피' },
];

export function createShuffledDeck(rng: () => number = Math.random): Card[] {
  const deck = [...DECK];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = deck[i]!;
    deck[i] = deck[j]!;
    deck[j] = tmp;
  }
  return deck;
}

export function getCardById(id: string): Card | undefined {
  return DECK.find((c) => c.id === id);
}

let bombSerial = 0;

/**
 * 폭탄 카드 생성 — 폭탄 발동 후 본인 손패에 보너스로 추가됨.
 * 클릭 시 매칭 시도 X, 손패에서만 제거되고 더미 1장만 뒤집힘.
 * id는 매번 unique (React key / 매칭 회피용).
 */
export function createBombCard(): Card {
  bombSerial += 1;
  return {
    id: `bomb-${Date.now()}-${bombSerial}`,
    month: 1, // 매칭 안 되도록 isBomb로 분기되며 month 자체는 의미 X
    kind: 'pi', // 점수 계산은 collected에 안 들어가므로 영향 없음
    name: '💣 폭탄',
    isBomb: true,
  };
}

let jokerSerial = 0;

/**
 * 조커 카드 생성 — 옵션 룰. 쌍피 가치, 매칭 X.
 * 클릭 시 손패 → collected 이동 + 더미 1장 뒤집기.
 */
export function createJokerCard(): Card {
  jokerSerial += 1;
  return {
    id: `joker-${jokerSerial}`,
    month: 1,
    kind: 'pi',
    name: '🃏 조커',
    isJoker: true,
    isSsangPi: true,
  };
}

/**
 * 폭탄 발동 후 본인 손패에 폭탄 보너스 카드 2장 추가.
 * server/aiTurn/SoloPlay 공통 (rules-final.md §4 사용자 변형).
 */
export function awardBombBonusCards(hand: readonly Card[]): Card[] {
  return [...hand, createBombCard(), createBombCard()];
}
