import type { Card, Month } from './card.ts';

export interface PlayerFlags {
  shookMonths: Month[];
  bombs: number;
  /** 이 player가 싼 뻑 누적 횟수. 3 도달 시 자동 3점 승리 (rules-final.md, 옵션) */
  ppeoksCaused: number;
  /**
   * 9월 열끗을 쌍피로 변환 (rules-final.md §1-5).
   * 본인이 자유 토글. 스톱 선언 후엔 봉인.
   */
  nineYeolAsSsangPi?: boolean;
  /**
   * 시간 초과로 자동 카드 발동된 turn 연속 카운트.
   * 사용자가 직접 카드 내면 reset 0. 2 이상이면 그 player turn 제한 시간이 5초로 단축.
   * (브라우저 닫음/네트워크 끊김 등 long-AFK player 게임 진행 가속)
   */
  consecutiveAutoTurns?: number;
}

export interface Player {
  readonly id: string;
  readonly nickname: string;
  readonly emojiAvatar: string;
  hand: Card[];
  collected: Card[];
  score: number;
  goCount: number;
  flags: PlayerFlags;
  connected: boolean;
}
