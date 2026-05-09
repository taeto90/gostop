import type { Month } from './card.ts';

export type GameAction =
  | {
      type: 'play-card';
      cardId: string;
      /** 손패 매칭이 다른 종류 2장일 때 사용자 선택 카드 id (rules-final.md §1) */
      targetAfterHand?: string;
      /** 더미 매칭이 다른 종류 2장일 때 사용자 선택 카드 id */
      targetAfterDraw?: string;
    }
  | { type: 'choose-flip'; chosenCardId: string }
  | { type: 'declare-go' }
  | { type: 'declare-stop' }
  | { type: 'shake'; month: Month }
  | { type: 'bomb'; cardIds: string[] };
