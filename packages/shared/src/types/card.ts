export type Month = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export type CardKind = 'gwang' | 'yeol' | 'ddi' | 'pi';

export type DdiKind = 'hong' | 'cheong' | 'cho' | 'bi';

export interface Card {
  readonly id: string;
  readonly month: Month;
  readonly kind: CardKind;
  readonly ddiKind?: DdiKind;
  readonly isBigwang?: boolean;
  readonly isSsangPi?: boolean;
  readonly isGoDori?: boolean;
  readonly name: string;
  /**
   * 폭탄 카드 — 폭탄 발동 후 손패에 추가되는 가상 카드.
   * 매칭 X, 점수 X, 클릭 시 손패에서 제거되고 더미 1장만 뒤집힘.
   * (rules-final.md §4: 폭탄 후 남은 2턴 손패 안 내고 더미만 뒤집기)
   */
  readonly isBomb?: boolean;
  /**
   * 조커 카드 — 옵션 룰. 쌍피 가치로 collected. 매칭 X.
   * 클릭 시 손패에서 제거되고 collected에 isSsangPi 카드처럼 추가 +
   * 더미 1장 뒤집기 (rule3·rule4 / rules-final.md §1-4).
   */
  readonly isJoker?: boolean;
}
