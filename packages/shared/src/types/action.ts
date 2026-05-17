import type { Month } from './card.ts';

export type GameAction =
  | {
      type: 'play-card';
      cardId: string;
      /** 손패 매칭이 다른 종류 2장일 때 사용자 선택 카드 id (rules-final.md §1) */
      targetAfterHand?: string;
      /** 더미 매칭이 다른 종류 2장일 때 사용자 선택 카드 id */
      targetAfterDraw?: string;
      /**
       * 흔들기 O + 바닥 매칭 O에서 사용자가 [1장 내기] 선택 시 true (rules-final.md §4-2 ②).
       * 폭탄 자동 발동 차단 — 일반 매칭으로 처리.
       */
      declineBomb?: boolean;
    }
  | { type: 'choose-flip'; chosenCardId: string }
  | { type: 'declare-go' }
  | { type: 'declare-stop' }
  | { type: 'shake'; month: Month }
  | { type: 'bomb'; cardIds: string[] };
