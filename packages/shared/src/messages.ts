import type { AiDifficulty } from './ai/simple.ts';
import type { Card } from './types/card.ts';
import type { GameAction } from './types/action.ts';
import type { RoomListItem } from './types/room.ts';
import type { RoomView } from './types/views.ts';

/**
 * Socket.io 메시지 응답 타입.
 */
export type Result<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

/**
 * play-card 액션 응답 — 매칭 종류 다름 2장일 때 needsSelection 반환.
 * 클라가 모달 띄우고 사용자 선택 후 동일 액션을 targetAfterHand/Draw 포함해 재요청.
 */
export type PlayCardResponse =
  | { ok: true }
  | { ok: false; error: string }
  | {
      ok: false;
      needsSelection: {
        stage: 'hand' | 'draw';
        candidates: Card[];
        drawnCard?: Card;
      };
    };

/**
 * 클라이언트 → 서버 이벤트.
 */
export interface ClientToServerEvents {
  'room:create': (
    payload: {
      userId: string;
      nickname: string;
      emojiAvatar: string;
      asSpectator: boolean;
      /** 비밀방 비밀번호 (4~20자, optional). 없으면 오픈방 */
      password?: string;
      /** 화상/음성 모드 — default 'video' */
      mediaMode?: 'video' | 'voice-only';
    },
    callback: (result: Result<{ roomId: string }>) => void,
  ) => void;

  'room:join': (
    payload: {
      userId: string;
      roomId: string;
      nickname: string;
      emojiAvatar: string;
      asSpectator: boolean;
      /** 비밀방 입장 시 비밀번호 */
      password?: string;
    },
    callback: (result: Result) => void,
  ) => void;

  /** 로비에서 방 목록 조회 — 비밀방은 hasPassword: true (비번 자체는 X) */
  'room:list': (
    callback: (result: Result<{ rooms: RoomListItem[] }>) => void,
  ) => void;

  'room:rejoin': (
    payload: { userId: string; roomId: string },
    callback: (result: Result) => void,
  ) => void;

  'room:leave': (callback: (result: Result) => void) => void;

  /**
   * 게임 시작 — 호스트만 호출. player 1~2명일 때 botDifficulties로 AI 봇 추가 (각 봇별 난이도).
   * botDifficulties.length = 추가할 봇 수. player + bot ≤ 5.
   * 생략 시 player가 1명이면 medium 1명 자동 추가 (기존 동작).
   * testMode=true면 손패 1장 + 바닥 1장만 분배 (흐름 검증용, 추후 제거).
   */
  'game:start': (
    payload: { botDifficulties?: AiDifficulty[]; testMode?: boolean },
    callback: (result: Result) => void,
  ) => void;

  /**
   * 봇 즉시 추가 (대기실 한정, 호스트만). game:start와 분리 — 봇 추가 후 다른 사용자도
   * 시각적으로 봇 슬롯 채워진 것을 봄. botDifficulties.length만큼 추가.
   */
  'room:add-bots': (
    payload: { botDifficulties: AiDifficulty[] },
    callback: (result: Result) => void,
  ) => void;

  'game:action': (
    payload: GameAction,
    callback: (result: PlayCardResponse) => void,
  ) => void;

  'reaction:send': (
    payload: { emoji: string },
    callback: (result: Result) => void,
  ) => void;

  /** 본인 광팔이 자원 토글 (대기실 한정) */
  'room:toggle-gwangpali-volunteer': (
    callback: (result: Result) => void,
  ) => void;

  /** 호스트가 다른 player를 광팔이로 지정/해제 (대기실 한정) */
  'room:assign-gwangpali': (
    payload: { targetUserId: string; assigned: boolean },
    callback: (result: Result) => void,
  ) => void;

  /**
   * player ↔ spectator 토글 (대기실 한정).
   * targetUserId 생략 시 본인. 다른 사용자 토글은 호스트만 가능.
   * - player → spectator: room.players에서 제거 + room.spectators에 추가 (isGwangPali=false)
   * - spectator → player: 그 반대 (5명 미만일 때만)
   */
  'room:toggle-spectator': (
    payload: { targetUserId?: string },
    callback: (result: Result) => void,
  ) => void;

  /** 호스트가 다른 멤버를 강퇴 (대기실 한정) */
  'room:kick': (
    payload: { targetUserId: string },
    callback: (result: Result) => void,
  ) => void;

  /**
   * 호스트가 player 순서 재배열 (대기실 한정).
   * playerIds는 새 순서. 모두 현재 멤버여야 + 길이 일치 (검증 안 맞으면 reject).
   */
  'room:reorder-players': (
    payload: { playerIds: string[] },
    callback: (result: Result) => void,
  ) => void;

  /** 호스트가 다른 멤버에게 방장 권한 위임 (대기실 한정) */
  'room:transfer-host': (
    payload: { targetUserId: string },
    callback: (result: Result) => void,
  ) => void;

  /**
   * 호스트가 게임 종료(ended) 후 대기실(waiting)로 복귀.
   * - room.game = null, phase='waiting', stuckOwners/chongtongUserId reset
   * - nagariMultiplier는 보존 (다음 판이 그 누적값으로 시작)
   * - 광팔이 spectator → player 복귀
   * - AI 봇은 그대로 유지 (호스트가 대기실에서 변경 가능)
   * 이후 호스트가 다시 game:start emit하면 새 판 시작.
   */
  'room:return-to-lobby': (callback: (result: Result) => void) => void;

  /**
   * 사용자의 현재 멤버십 조회 — 새로고침/로비 mount 시 호출.
   * 한 사용자 한 방 정책상 결과는 0~1개. 있으면 RoomListItem 형식으로 반환.
   */
  'room:my-current': (
    payload: { userId: string },
    callback: (result: Result<{ room: RoomListItem | null }>) => void,
  ) => void;

  /** 호스트가 방 룰 변경 (대기실 한정) */
  'room:update-rules': (
    payload: { rules: Partial<import('./types/rules.ts').RoomRules> },
    callback: (result: Result) => void,
  ) => void;

  /** 텍스트 채팅 메시지 전송 (방 멤버 전체에 broadcast) */
  'chat:send': (
    payload: { text: string },
    callback: (result: Result) => void,
  ) => void;

  /** 본인의 9월 열끗 ↔ 쌍피 변환 토글 (rules-final.md §1-5) */
  'game:toggle-9yeol': (
    payload: { value: boolean },
    callback: (result: Result) => void,
  ) => void;

  /**
   * 쇼당 선언 — 본인 턴에 즉시 나가리 처리 (rules-final.md §7).
   * 친구간 협의 룰. 자동 검증 X — 사용자 합의로만 선언.
   */
  'game:declare-shodang': (callback: (result: Result) => void) => void;

  'ping:check': (callback: (response: { time: number }) => void) => void;
}

/**
 * 서버 → 클라이언트 이벤트.
 */
export interface ServerToClientEvents {
  'room:state': (state: RoomView) => void;
  'room:player-disconnected': (payload: { userId: string }) => void;
  'room:player-reconnected': (payload: { userId: string }) => void;
  'room:closed': (payload: { reason: string }) => void;
  'reaction:received': (payload: { fromUserId: string; emoji: string }) => void;
  'chat:received': (payload: {
    fromUserId: string;
    fromNickname: string;
    fromEmoji: string;
    text: string;
    timestamp: number;
  }) => void;
  /**
   * 호스트가 방 룰 변경 시 모든 멤버에게 broadcast — toast 알림용.
   * `changes`는 변경된 키만 (모든 룰이 아니라 diff). 본인(호스트)도 받음.
   */
  'room:rules-changed': (payload: {
    byNickname: string;
    changes: Partial<import('./types/rules.ts').RoomRules>;
  }) => void;
  'error': (payload: { message: string }) => void;
}
