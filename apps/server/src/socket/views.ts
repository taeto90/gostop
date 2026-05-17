import type {
  PlayerStateView,
  Room,
  RoomView,
  SpectatorView,
} from '@gostop/shared';

/**
 * Phase 2 정책: 관전자는 모든 플레이어 손패를 본다 (친구놀이 분위기 강화).
 * 추후 옵션으로 토글 가능하게 변경 예정.
 */
const SPECTATORS_SEE_ALL_HANDS = true;

/**
 * Room 전체 상태를 특정 사용자(userId) 시점의 RoomView로 변환.
 * - 본인이 플레이어면: 본인 손패만 보임
 * - 관전자면: SPECTATORS_SEE_ALL_HANDS 정책에 따라
 */
export function buildRoomView(room: Room, viewerUserId: string): RoomView {
  const amSpectator = !room.players.some((p) => p.id === viewerUserId);

  const players: PlayerStateView[] = room.players.map((p) => {
    const isMine = p.id === viewerUserId;
    const showHand = isMine || (amSpectator && SPECTATORS_SEE_ALL_HANDS);
    return {
      userId: p.id,
      nickname: p.nickname,
      emojiAvatar: p.emojiAvatar,
      connected: p.connected,
      hand: showHand ? p.hand : undefined,
      handCount: p.hand.length,
      collected: p.collected,
      score: p.score,
      goCount: p.goCount,
      flags: p.flags,
    };
  });

  const spectators: SpectatorView[] = room.spectators.map((s) => ({
    userId: s.id,
    nickname: s.nickname,
    emojiAvatar: s.emojiAvatar,
    connected: s.connected,
  }));

  return {
    roomId: room.id,
    hostUserId: room.hostId,
    maxPlayers: room.maxPlayers,
    phase: room.phase,
    players,
    spectators,
    field: room.game?.field ?? [],
    deckCount: room.game?.deck.length ?? 0,
    turnUserId: room.game?.turnPlayerId ?? null,
    goCount: room.game?.goCount ?? 0,
    history: room.game?.history ?? [],
    myUserId: viewerUserId,
    amSpectator,
    gwangPaliVolunteers: room.gwangPaliVolunteers,
    gwangPaliAssignments: room.gwangPaliAssignments,
    chongtongUserId: room.chongtongUserId,
    testMode: room.testMode,
    testPreset: room.testPreset,
    gameInstanceId: room.gameInstanceId,
    nagariMultiplier: room.nagariMultiplier,
    rules: room.rules,
    lastTurnSpecials: room.lastTurnSpecials ?? null,
    lastTurnActorUserId: room.lastTurnActorUserId ?? null,
    turnSeq: room.turnSeq ?? 0,
    turnStartedAt: room.turnStartedAt,
    currentTurnLimitSec: room.currentTurnLimitSec,
    pendingGoStop: room.pendingGoStop ?? null,
  };
}
