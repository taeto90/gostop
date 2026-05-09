/**
 * 방마다 호스트가 변경할 수 있는 룰 설정 (rules-final.md 기반).
 *
 * - 게임 시작 후에는 변경 불가 (다음 판부터 새 룰 적용)
 * - 일부 옵션은 점진 적용 (turnTimeLimitSec 등은 UI만 — 코드 미반영)
 */
export interface RoomRules {
  /**
   * 났음 도달 점수.
   * - default: 2인 7점, 3인+ 3점 (rules-final.md)
   * - 호스트가 5점/7점 등으로 override 가능
   */
  winScore: 3 | 5 | 7;
  /**
   * 흔들기/폭탄 점수 처리 방식.
   * - 'multiplier': 점수 ×2 (표준, default)
   * - 'addPoint': 점수에 +N점 (변형)
   */
  shakeBonusType: 'multiplier' | 'addPoint';
  /** 폭탄 발동 시 상대로부터 빼앗는 피 장수 (default 1) */
  bombStealCount: 1 | 2;
  /** 국준 인정 여부 (default true) — 미구현, UI만 */
  allowGukJoon: boolean;
  /** 멍따(끗 7장 ×2) 인정 여부 (default true) */
  allowMyungttadak: boolean;
  /** 턴 시간 제한 (초). 0이면 없음 (default). 시간 초과 시 자동 카드 플레이 */
  turnTimeLimitSec: 0 | 30 | 40 | 50 | 60 | 90;
  /**
   * 조커 카드 수 — 옵션 룰 (rule3·rule4).
   * 0이면 사용 안 함 (default). 1~3장 추가 시 셔플에 포함되어 분배.
   * 조커는 매칭 X, 클릭 시 collected에 쌍피 가치로 들어감.
   */
  jokerCount: 0 | 1 | 2 | 3;
  /**
   * 화상 채팅 모드 — 'video' (기본, 카메라+마이크) / 'voice-only' (마이크만).
   * 'voice-only'면 LiveKit 토큰 발급 시 video publish 권한 X (서버 측 강제).
   * 클라는 카메라 트랙 publish 시도 자체를 안 함.
   */
  mediaMode: 'video' | 'voice-only';
}

/** 기본 룰 — 표준 화투 룰 (rules-final.md). */
export function defaultRoomRules(): RoomRules {
  return {
    winScore: 3,
    shakeBonusType: 'multiplier',
    bombStealCount: 1,
    allowGukJoon: true,
    allowMyungttadak: true,
    turnTimeLimitSec: 0,
    jokerCount: 0,
    mediaMode: 'video',
  };
}
