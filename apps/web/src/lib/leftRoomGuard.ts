/**
 * "직전에 명시적으로 leave한 방"을 sessionStorage에 짧게 기록.
 *
 * 목적: 사용자가 "나가기" 버튼으로 방을 떠난 직후 뒤로 가기 / HMR / URL 직접 입력 등으로
 * 같은 방 URL이 재진입되어도 자동 재join 흐름이 발동하지 않도록 차단.
 * 명시적 입장(lobby의 방 카드 클릭, LobbyResumeCard, 방 만들기)에서는 flag를 제거해
 * 정상 입장이 가능하게 한다.
 *
 * grace 시간(60초)은 사용자가 같은 방으로 우연히 재진입할 가능성이 큰 시간대만 커버.
 */

const LEFT_ROOM_KEY = 'gostop:leftRoomId';
const LEFT_AT_KEY = 'gostop:leftAt';
const GRACE_MS = 60_000;

/** 방을 명시적으로 떠난 시점 기록 (handleLeave / leaveRoom 등에서 호출) */
export function markRoomLeft(roomId: string): void {
  sessionStorage.setItem(LEFT_ROOM_KEY, roomId);
  sessionStorage.setItem(LEFT_AT_KEY, String(Date.now()));
}

/** 사용자가 명시적으로 입장하는 시점에 호출 (lobby의 방 카드/LobbyResumeCard/방 만들기) */
export function clearLeftRoomGuard(): void {
  sessionStorage.removeItem(LEFT_ROOM_KEY);
  sessionStorage.removeItem(LEFT_AT_KEY);
}

/**
 * 직전에 leave한 방인지 검사 — RoomScreen 자동 재join 흐름에서 사용.
 * grace 시간(60s)이 지났으면 false를 반환해 정상 입장 허용.
 */
export function wasRecentlyLeft(roomId: string): boolean {
  const left = sessionStorage.getItem(LEFT_ROOM_KEY);
  const at = Number(sessionStorage.getItem(LEFT_AT_KEY) ?? 0);
  if (left !== roomId) return false;
  return Date.now() - at < GRACE_MS;
}
