import type { Card } from './card.ts';
import type { GameAction } from './action.ts';
import type { PlayerFlags } from './player.ts';
import type { GamePhase } from './room.ts';

/**
 * 플레이어 1명에 대한 뷰. hand는 시점에 따라 노출 여부 다름.
 */
export interface PlayerStateView {
  userId: string;
  nickname: string;
  emojiAvatar: string;
  connected: boolean;
  hand?: Card[];
  handCount: number;
  collected: Card[];
  score: number;
  goCount: number;
  flags: PlayerFlags;
}

export interface SpectatorView {
  userId: string;
  nickname: string;
  emojiAvatar: string;
  connected: boolean;
}

/**
 * 클라이언트로 전달되는 방 상태 뷰.
 * 서버는 시점에 따라 hand 노출 여부를 조정한 뒤 전송.
 */
export interface RoomView {
  roomId: string;
  hostUserId: string;
  maxPlayers: 2 | 3 | 5;
  phase: GamePhase;

  /** 게임 참가자들 (자기 자신 포함) */
  players: PlayerStateView[];
  /** 관전자들 */
  spectators: SpectatorView[];

  /** 바닥 카드 */
  field: Card[];
  /** 더미 카드 수 (실제 카드 정보는 노출 X) */
  deckCount: number;
  /** 현재 턴 플레이어 userId. 게임 시작 전이면 null */
  turnUserId: string | null;
  /** 누가 몇 번 고 했는지 (현재 턴 플레이어 기준) */
  goCount: number;
  /** 액션 히스토리 (모두에게 보임) */
  history: GameAction[];

  /** 이 뷰를 보는 사람의 userId */
  myUserId: string;
  /** 관전자인지 */
  amSpectator: boolean;

  /** 광팔이 자원자 userId 리스트 (대기실에서 본인이 토글) */
  gwangPaliVolunteers?: string[];
  /** 호스트가 광팔이로 지정한 userId 리스트 */
  gwangPaliAssignments?: string[];
  /** 총통 발동자 userId (시작 시 손패 같은 월 4장 → 즉시 승리) */
  chongtongUserId?: string | null;
  /** 직전 판이 나가리였으면 다음 판 점수 multiplier (default 1) */
  nagariMultiplier?: number;
  /** 방 룰 (호스트가 대기실에서 변경 가능) */
  rules?: import('./rules.ts').RoomRules;
  /**
   * 직전 turn의 specials (시각효과 발화용).
   * broadcast마다 갱신 — 클라가 phase 변경 또는 turn 변경 감지 시 EventOverlay trigger.
   * null이면 발화할 이벤트 없음 (게임 시작 직후 등).
   */
  lastTurnSpecials?: import('../rules/game.ts').TurnSpecials | null;
  /** 직전 turn의 actor userId — 본인이 한 액션과 다른 player 액션 구분용 */
  lastTurnActorUserId?: string | null;
  /** broadcast 시퀀스 번호 — 같은 specials도 새 turn마다 trigger되도록 */
  turnSeq?: number;
  /** 현재 turn 시작 시각 (ms timestamp) — 모든 client가 동일 시점 기준 카운트다운 표시 */
  turnStartedAt?: number;
  /** 현재 turn 제한 시간 (초). 0이면 제한 없음. 자동 발동 2회+ player는 5초 단축됨 */
  currentTurnLimitSec?: number;
  /** 테스트 모드 (손패 1장 + 바닥 1장 분배) — 추후 제거 */
  testMode?: boolean;
}

/**
 * 사용자 정체 (소켓 연결 시).
 */
export interface UserIdentity {
  userId: string;
  nickname: string;
  emojiAvatar: string;
}
