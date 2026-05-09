import type { Player, Room, Spectator, UserIdentity } from '@gostop/shared';

export type OpResult = { ok: true } | { ok: false; error: string };

export function isMember(room: Room, userId: string): boolean {
  return (
    room.players.some((p) => p.id === userId) || room.spectators.some((s) => s.id === userId)
  );
}

export function findPlayer(room: Room, userId: string): Player | undefined {
  return room.players.find((p) => p.id === userId);
}

export function findSpectator(room: Room, userId: string): Spectator | undefined {
  return room.spectators.find((s) => s.id === userId);
}

/**
 * 플레이어 추가. 이미 방의 플레이어면 idempotent하게 connection만 갱신.
 * 관전자였다면 게임 시작 전 한정으로 플레이어 전환 허용.
 */
export function addPlayer(room: Room, identity: UserIdentity): OpResult {
  // 이미 플레이어 → idempotent 처리
  const existingPlayer = findPlayer(room, identity.userId);
  if (existingPlayer) {
    existingPlayer.connected = true;
    return { ok: true };
  }

  if (room.phase !== 'waiting') {
    return { ok: false, error: '게임 진행 중에는 플레이어로 입장할 수 없습니다' };
  }

  // 관전자였으면 게임 시작 전 플레이어 전환 (자리 있을 때)
  const existingSpec = findSpectator(room, identity.userId);
  if (existingSpec) {
    if (room.players.length >= room.maxPlayers) {
      return { ok: false, error: '플레이어 자리가 가득 찼습니다' };
    }
    room.spectators = room.spectators.filter((s) => s.id !== identity.userId);
  }

  if (room.players.length >= room.maxPlayers) {
    return { ok: false, error: '플레이어 자리가 가득 찼습니다' };
  }

  room.players.push({
    id: identity.userId,
    nickname: identity.nickname,
    emojiAvatar: identity.emojiAvatar,
    hand: [],
    collected: [],
    score: 0,
    goCount: 0,
    flags: { shookMonths: [], bombs: 0, ppeoksCaused: 0, consecutiveAutoTurns: 0 },
    connected: true,
  });
  return { ok: true };
}

/**
 * 관전자 추가. 이미 관전자면 idempotent. 플레이어였으면 게임 시작 전에만 전환.
 */
export function addSpectator(room: Room, identity: UserIdentity): OpResult {
  const existingSpec = findSpectator(room, identity.userId);
  if (existingSpec) {
    existingSpec.connected = true;
    return { ok: true };
  }

  const existingPlayer = findPlayer(room, identity.userId);
  if (existingPlayer) {
    if (room.phase !== 'waiting') {
      return { ok: false, error: '게임 진행 중에는 관전자로 전환할 수 없습니다' };
    }
    room.players = room.players.filter((p) => p.id !== identity.userId);
  }

  room.spectators.push({
    id: identity.userId,
    nickname: identity.nickname,
    emojiAvatar: identity.emojiAvatar,
    joinedAt: Date.now(),
    connected: true,
  });
  return { ok: true };
}

const AI_BOT_PREFIX = 'ai-bot-';

/**
 * 방에서 사용자를 완전히 제거. 호스트가 떠나면 다른 사용자에게 위임.
 * 반환: 방이 비었는지 여부 (true면 방을 삭제해야 함)
 *
 * - players + spectators가 모두 비면 empty=true
 * - 또는 사람 사용자가 모두 떠나고 AI 봇만 남았으면 empty=true (좀비 방 방지)
 */
export function removeMember(room: Room, userId: string): { empty: boolean } {
  room.players = room.players.filter((p) => p.id !== userId);
  room.spectators = room.spectators.filter((s) => s.id !== userId);

  if (room.players.length === 0 && room.spectators.length === 0) {
    return { empty: true };
  }

  // 사람 사용자 0명 + AI 봇만 남은 경우 — 의미 없는 방이므로 삭제
  const hasHumanPlayer = room.players.some((p) => !p.id.startsWith(AI_BOT_PREFIX));
  const hasHumanSpectator = room.spectators.length > 0; // spectator는 항상 사람
  if (!hasHumanPlayer && !hasHumanSpectator) {
    return { empty: true };
  }

  // 호스트가 떠났으면 다음 사람 사용자에게 위임 (AI 봇은 호스트 X)
  if (room.hostId === userId) {
    const newHost =
      room.players.find((p) => !p.id.startsWith(AI_BOT_PREFIX))?.id ??
      room.spectators[0]?.id;
    if (newHost) room.hostId = newHost;
  }

  return { empty: false };
}

/**
 * 사용자의 연결 상태 변경 (재접속/끊김).
 */
export function setMemberConnected(room: Room, userId: string, connected: boolean): boolean {
  const player = findPlayer(room, userId);
  if (player) {
    player.connected = connected;
    return true;
  }
  const spectator = findSpectator(room, userId);
  if (spectator) {
    spectator.connected = connected;
    return true;
  }
  return false;
}
