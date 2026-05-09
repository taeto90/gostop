import type { AiDifficulty } from '../ai/simple.ts';
import type { Card } from './card.ts';
import type { Player } from './player.ts';
import type { GameAction } from './action.ts';
import type { RoomRules } from './rules.ts';

export type GamePhase = 'waiting' | 'dealing' | 'playing' | 'go-stop-decision' | 'ended';

export interface Spectator {
  readonly id: string;
  readonly nickname: string;
  readonly emojiAvatar: string;
  readonly joinedAt: number;
  connected: boolean;
  /**
   * true면 광팔이로 이동된 spectator (게임 시작 시 자동 분배 또는 호스트 지정).
   * 다음 판 시작 시 player로 자동 복귀. 의도적 spectator(처음부터 관전)는 false.
   */
  isGwangPali?: boolean;
}

export interface GameState {
  field: Card[];
  deck: Card[];
  turnPlayerId: string;
  history: GameAction[];
  goCount: number;
  startedAt: number;
}

export interface Room {
  readonly id: string;
  hostId: string;
  players: Player[];
  spectators: Spectator[];
  maxPlayers: 2 | 3 | 5;
  phase: GamePhase;
  game: GameState | null;
  createdAt: number;
  /** 광팔이 자원자 (본인이 토글). 5인 방에서 게임 시작 시 우선 적용 */
  gwangPaliVolunteers: string[];
  /** 호스트가 광팔이로 지정한 userId 리스트 */
  gwangPaliAssignments: string[];
  /** 뻑 stuck month → owner userId (자뻑 vs 일반 회수 구분, rules-final.md) */
  stuckOwners: Record<number, string>;
  /** 직전 판이 나가리였으면 다음 판 점수 multiplier (default 1) */
  nagariMultiplier: number;
  /** 시작 시 손패 같은 월 4장 → 즉시 승리. 발동자 userId */
  chongtongUserId: string | null;
  /** 호스트가 변경 가능한 방 룰 (시작 점수, 멍따 인정 등) */
  rules: RoomRules;
  /** 직전 turn의 specials — 클라 broadcast 시 EventOverlay 발화 (선택 필드) */
  lastTurnSpecials?: import('../rules/game.ts').TurnSpecials | null;
  /** 직전 turn의 actor — 본인 액션 vs 다른 player 구분용 */
  lastTurnActorUserId?: string | null;
  /** turn 시퀀스 번호 — broadcast마다 +1 */
  turnSeq?: number;
  /** 비밀방 비밀번호 (4~20자). 없으면 오픈방 — 누구나 입장 가능 */
  password?: string;
  /** 현재 turn 시작 시각 (ms timestamp). 클라가 카운트다운 표시용 */
  turnStartedAt?: number;
  /** 현재 turn 제한 시간 (초). 0이면 제한 없음. 2번 연속 자동이면 5초 단축 */
  currentTurnLimitSec?: number;
  /** server-side timer 참조 (직렬화 X — Node.js setTimeout return) */
  turnTimerRef?: ReturnType<typeof setTimeout>;
  /**
   * AI 봇 userId → 난이도 매핑. 호스트가 game:start에서 botDifficulties로 설정.
   * 매 판마다 startGameInRoom에서 같은 봇 재사용 (game:next-round에서도 유지).
   */
  aiBotDifficulties?: Record<string, AiDifficulty>;
  /**
   * 테스트 모드 — 손패 1장 + 바닥 1장만 분배. 흐름 검증용 (추후 제거).
   * game:start 시 호스트가 설정. game:next-round에서도 유지.
   */
  testMode?: boolean;
}

/**
 * 로비에서 보여줄 방 목록 항목 (비밀번호 자체는 노출 X — 잠금 여부만).
 */
export interface RoomListItem {
  id: string;
  hostNickname: string;
  hostEmoji: string;
  playerCount: number;
  spectatorCount: number;
  maxPlayers: 2 | 3 | 5;
  phase: GamePhase;
  /** 비밀방인지 (비밀번호 입력 필요) */
  hasPassword: boolean;
  createdAt: number;
}
