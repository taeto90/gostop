import type { Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@gostop/shared';
import { executeTurn } from '@gostop/shared';
import { playCardForPlayer, scheduleAutoTurnTimer } from './turnFlow.ts';

import type { RoomStore } from '../rooms/RoomStore.ts';
import {
  addPlayer,
  addSpectator,
  findPlayer,
  isMember,
  removeMember,
  setMemberConnected,
} from '../rooms/playerOps.ts';
import { progressAITurnIfAny } from './aiTurn.ts';
import {
  broadcastRoomState,
  gameRoom,
  type IO,
  type SocketData,
  userRoom,
} from './broadcast.ts';
import {
  fillWithAIBotsIfNeeded,
  isAIBot,
  reconvertSpectatorsToPlayers,
  removeAIBots,
  startGameInRoom,
  stealPiFromOpponents,
} from './gameLogic.ts';
import {
  AddBotsSchema,
  AssignGwangPaliSchema,
  ChatSendSchema,
  Toggle9YeolSchema,
  GameActionSchema,
  GameStartSchema,
  RoomCreateSchema,
  RoomJoinSchema,
  RoomRejoinSchema,
  TargetUserSchema,
  UpdateRulesSchema,
} from './schemas.ts';

type IOSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

export function registerSocketHandlers(io: IO, roomStore: RoomStore): void {
  io.on('connection', (socket: IOSocket) => {
    console.log(`[socket] connected: ${socket.id}`);

    socket.on('ping:check', (cb) => cb({ time: Date.now() }));

    /**
     * 한 사용자(userId)는 한 번에 한 방에만 멤버일 수 있음.
     * room:create / room:join 직전 호출.
     *
     * - 다른 방의 phase='waiting' 또는 'ended'면 자동으로 그 방에서 정리
     * - 다른 방이 phase='playing'면 거부 (게임 중인 다른 멤버 보호)
     */
    function evictUserFromOtherRooms(
      userId: string,
      exceptRoomId?: string,
    ): { ok: true } | { ok: false; error: string } {
      for (const r of roomStore.list()) {
        if (exceptRoomId && r.id === exceptRoomId) continue;
        if (!isMember(r, userId)) continue;

        if (r.phase === 'playing') {
          console.warn(
            `[evict] reject: userId=${userId} 다른 방(${r.id}) 게임 중`,
          );
          return {
            ok: false,
            error: `다른 방에서 게임 진행 중입니다 (방 ${r.id}). 먼저 그 방에서 나가주세요.`,
          };
        }

        const { empty } = removeMember(r, userId);
        console.log(
          `[evict] userId=${userId} → roomId=${r.id} 제거 (empty=${empty}, phase=${r.phase})`,
        );
        if (empty) {
          roomStore.delete(r.id);
        } else {
          broadcastRoomState(io, r);
        }
      }
      // 이전 socket이 다른 gameRoom에 join했다면 leave (같은 socket 한정)
      for (const sockRoomId of socket.rooms) {
        if (sockRoomId === socket.id) continue;
        if (
          sockRoomId.startsWith('room:') &&
          sockRoomId !== `room:${exceptRoomId ?? ''}`
        ) {
          socket.leave(sockRoomId);
        }
      }
      return { ok: true };
    }

    // ============================== chat:send ==============================
    socket.on('chat:send', (payload, cb) => {
      const { userId, roomId } = socket.data;
      if (!userId || !roomId) return cb({ ok: false, error: '방에 입장하지 않음' });

      const room = roomStore.get(roomId);
      if (!room) return cb({ ok: false, error: '방을 찾을 수 없음' });

      const parsed = ChatSendSchema.safeParse(payload);
      if (!parsed.success) return cb({ ok: false, error: '메시지 1~200자 이내' });

      // 발신자 정보 (player 또는 spectator)
      const sender =
        room.players.find((p) => p.id === userId) ??
        room.spectators.find((s) => s.id === userId);
      if (!sender) return cb({ ok: false, error: '방의 멤버가 아님' });

      // 본인 제외 broadcast — 클라가 emitWithAck 성공 후 직접 store에 push
      // (optimistic update + 본인 socket이 gameRoom에 join 안 된 race condition 회피)
      socket.to(gameRoom(roomId)).emit('chat:received', {
        fromUserId: userId,
        fromNickname: sender.nickname,
        fromEmoji: sender.emojiAvatar,
        text: parsed.data.text,
        timestamp: Date.now(),
      });
      cb({ ok: true });
    });

    // ============================== game:toggle-9yeol ==============================
    // 본인의 9월 열끗 ↔ 쌍피 변환 토글 (rules-final.md §1-5)
    socket.on('game:toggle-9yeol', (payload, cb) => {
      const { userId, roomId } = socket.data;
      if (!userId || !roomId) return cb({ ok: false, error: '방에 입장하지 않음' });
      const room = roomStore.get(roomId);
      if (!room) return cb({ ok: false, error: '방을 찾을 수 없음' });

      const parsed = Toggle9YeolSchema.safeParse(payload);
      if (!parsed.success) return cb({ ok: false, error: '입력 검증 실패' });

      const player = room.players.find((p) => p.id === userId);
      if (!player) return cb({ ok: false, error: '플레이어가 아님' });

      player.flags.nineYeolAsSsangPi = parsed.data.value;
      cb({ ok: true });
      broadcastRoomState(io, room);
    });

    // ============================== reaction:send ==============================
    socket.on('reaction:send', (payload, cb) => {
      const { userId, roomId } = socket.data;
      if (!userId || !roomId) return cb({ ok: false, error: '방에 입장하지 않음' });
      // 간단한 이모지 길이 검증
      if (typeof payload?.emoji !== 'string' || payload.emoji.length > 8) {
        return cb({ ok: false, error: '잘못된 이모지' });
      }
      io.to(gameRoom(roomId)).emit('reaction:received', {
        fromUserId: userId,
        emoji: payload.emoji,
      });
      cb({ ok: true });
    });

    // ============================== room:list ==============================
    // 로비에서 방 목록 조회 — 비밀방은 hasPassword: true (비번 자체는 노출 X)
    socket.on('room:list', (cb) => {
      const rooms = roomStore.list().map((r) => {
        const host =
          r.players.find((p) => p.id === r.hostId) ??
          r.spectators.find((s) => s.id === r.hostId);
        return {
          id: r.id,
          hostNickname: host?.nickname ?? '???',
          hostEmoji: host?.emojiAvatar ?? '👤',
          playerCount: r.players.length,
          spectatorCount: r.spectators.length,
          maxPlayers: r.maxPlayers,
          phase: r.phase,
          hasPassword: !!r.password,
          createdAt: r.createdAt,
        };
      });
      cb({ ok: true, data: { rooms } });
    });

    // ============================== room:create ==============================
    socket.on('room:create', (payload, cb) => {
      const parsed = RoomCreateSchema.safeParse(payload);
      if (!parsed.success) return cb({ ok: false, error: '입력 검증 실패' });
      const { userId, nickname, emojiAvatar, asSpectator, password, mediaMode } = parsed.data;

      // 한 사용자는 한 방에만 — 새 방 생성 전에 이전 방 정리 (게임 중인 방이면 거부)
      const evict = evictUserFromOtherRooms(userId);
      if (!evict.ok) return cb({ ok: false, error: evict.error });

      // 방은 항상 최대 5인까지. 게임 시작 시 인원에 따라 자동 분기:
      // 2~3명 → 일반 게임, 4~5명 → 광팔이 자동 적용 (player - 3명 spectator로).
      const room = roomStore.create({ hostId: userId, maxPlayers: 5 });
      if (password) room.password = password;
      if (mediaMode) room.rules.mediaMode = mediaMode;
      const op = asSpectator
        ? addSpectator(room, { userId, nickname, emojiAvatar })
        : addPlayer(room, { userId, nickname, emojiAvatar });

      if (!op.ok) {
        roomStore.delete(room.id);
        return cb({ ok: false, error: op.error });
      }

      socket.data.userId = userId;
      socket.data.roomId = room.id;
      socket.join(gameRoom(room.id));
      socket.join(userRoom(userId));

      cb({ ok: true, data: { roomId: room.id } });
      broadcastRoomState(io, room);
    });

    // ============================== room:join ==============================
    socket.on('room:join', (payload, cb) => {
      const parsed = RoomJoinSchema.safeParse(payload);
      if (!parsed.success) return cb({ ok: false, error: '입력 검증 실패' });
      const {
        userId,
        roomId,
        nickname,
        emojiAvatar,
        asSpectator,
        password,
      } = parsed.data;

      const room = roomStore.get(roomId);
      if (!room) return cb({ ok: false, error: '존재하지 않는 방입니다' });

      // 비밀방 검증 — 이미 멤버였으면 비번 재확인 X (rejoin은 별도 핸들러)
      if (room.password && !isMember(room, userId)) {
        if (!password) {
          return cb({ ok: false, error: '비밀방입니다. 비밀번호 필요' });
        }
        if (password !== room.password) {
          return cb({ ok: false, error: '비밀번호가 일치하지 않습니다' });
        }
      }

      // 한 사용자는 한 방에만 — 이미 다른 방의 멤버라면 그 방에서 정리 (게임 중이면 거부)
      const evict = evictUserFromOtherRooms(userId, roomId);
      if (!evict.ok) return cb({ ok: false, error: evict.error });

      const op = asSpectator
        ? addSpectator(room, { userId, nickname, emojiAvatar })
        : addPlayer(room, { userId, nickname, emojiAvatar });

      if (!op.ok) return cb({ ok: false, error: op.error });

      socket.data.userId = userId;
      socket.data.roomId = roomId;
      socket.join(gameRoom(roomId));
      socket.join(userRoom(userId));

      cb({ ok: true });
      broadcastRoomState(io, room);
    });

    // ============================== room:rejoin ==============================
    socket.on('room:rejoin', (payload, cb) => {
      const parsed = RoomRejoinSchema.safeParse(payload);
      if (!parsed.success) return cb({ ok: false, error: '입력 검증 실패' });
      const { userId, roomId } = parsed.data;

      const room = roomStore.get(roomId);
      if (!room) return cb({ ok: false, error: '존재하지 않는 방입니다' });
      if (!isMember(room, userId)) return cb({ ok: false, error: '방의 멤버가 아닙니다' });

      // 한 사용자 한 방 — 다른 방의 멤버면 정리 (게임 중이면 거부)
      const evict = evictUserFromOtherRooms(userId, roomId);
      if (!evict.ok) return cb({ ok: false, error: evict.error });

      setMemberConnected(room, userId, true);
      socket.data.userId = userId;
      socket.data.roomId = roomId;
      socket.join(gameRoom(roomId));
      socket.join(userRoom(userId));

      cb({ ok: true });
      io.to(gameRoom(roomId)).emit('room:player-reconnected', { userId });
      broadcastRoomState(io, room);
    });

    // ============================== room:leave ==============================
    socket.on('room:leave', (cb) => {
      const { userId, roomId } = socket.data;
      if (!userId || !roomId) return cb({ ok: false, error: '방에 입장하지 않음' });

      const room = roomStore.get(roomId);
      if (!room) return cb({ ok: false, error: '방을 찾을 수 없음' });

      const { empty } = removeMember(room, userId);
      socket.leave(gameRoom(roomId));
      socket.leave(userRoom(userId));
      socket.data.roomId = undefined;

      cb({ ok: true });

      if (empty) {
        roomStore.delete(roomId);
        return;
      }

      if (room.phase === 'playing' && room.players.length < 2) {
        room.phase = 'ended';
      }
      broadcastRoomState(io, room);
    });

    // ============================== room:toggle-gwangpali-volunteer ==============================
    socket.on('room:toggle-gwangpali-volunteer', (cb) => {
      const { userId, roomId } = socket.data;
      if (!userId || !roomId) return cb({ ok: false, error: '방에 입장하지 않음' });
      const room = roomStore.get(roomId);
      if (!room) return cb({ ok: false, error: '방을 찾을 수 없음' });
      if (room.phase !== 'waiting') {
        return cb({ ok: false, error: '대기실에서만 광팔이 자원 가능' });
      }
      if (!room.players.some((p) => p.id === userId)) {
        return cb({ ok: false, error: '플레이어만 자원 가능 (관전자는 불가)' });
      }

      if (room.gwangPaliVolunteers.includes(userId)) {
        room.gwangPaliVolunteers = room.gwangPaliVolunteers.filter((id) => id !== userId);
      } else {
        room.gwangPaliVolunteers = [...room.gwangPaliVolunteers, userId];
      }
      cb({ ok: true });
      broadcastRoomState(io, room);
    });

    // ============================== room:assign-gwangpali ==============================
    socket.on('room:assign-gwangpali', (payload, cb) => {
      const { userId, roomId } = socket.data;
      if (!userId || !roomId) return cb({ ok: false, error: '방에 입장하지 않음' });
      const room = roomStore.get(roomId);
      if (!room) return cb({ ok: false, error: '방을 찾을 수 없음' });
      if (room.phase !== 'waiting') {
        return cb({ ok: false, error: '대기실에서만 지정 가능' });
      }
      if (room.hostId !== userId) {
        return cb({ ok: false, error: '호스트만 광팔이 지정 가능' });
      }

      const parsed = AssignGwangPaliSchema.safeParse(payload);
      if (!parsed.success) return cb({ ok: false, error: '입력 검증 실패' });
      const { targetUserId, assigned } = parsed.data;

      if (!room.players.some((p) => p.id === targetUserId)) {
        return cb({ ok: false, error: '대상이 플레이어가 아님' });
      }

      if (assigned) {
        if (!room.gwangPaliAssignments.includes(targetUserId)) {
          room.gwangPaliAssignments = [...room.gwangPaliAssignments, targetUserId];
        }
      } else {
        room.gwangPaliAssignments = room.gwangPaliAssignments.filter(
          (id) => id !== targetUserId,
        );
      }
      cb({ ok: true });
      broadcastRoomState(io, room);
    });

    // ============================== room:add-bots ==============================
    // 호스트가 대기실에서 봇을 즉시 추가 — 게임 시작과 분리.
    // 다른 사용자도 broadcast로 봇 슬롯이 채워지는 것을 시각적으로 확인.
    socket.on('room:add-bots', (payload, cb) => {
      const { userId, roomId } = socket.data;
      if (!userId || !roomId) return cb({ ok: false, error: '방에 입장하지 않음' });
      const room = roomStore.get(roomId);
      if (!room) return cb({ ok: false, error: '방을 찾을 수 없음' });
      if (room.phase !== 'waiting') {
        return cb({ ok: false, error: '대기실에서만 봇 추가 가능' });
      }
      if (room.hostId !== userId) {
        return cb({ ok: false, error: '호스트만 봇 추가 가능' });
      }

      const parsed = AddBotsSchema.safeParse(payload);
      if (!parsed.success) return cb({ ok: false, error: '입력 검증 실패' });
      const { botDifficulties } = parsed.data;

      if (botDifficulties.length === 0) {
        return cb({ ok: false, error: '봇 인원이 0' });
      }
      if (room.players.length + botDifficulties.length > 5) {
        return cb({
          ok: false,
          error: `봇 추가 시 5명 초과 (현재 ${room.players.length}명 + 봇 ${botDifficulties.length}명)`,
        });
      }

      // 기존 봇 모두 제거 후 새로 추가 (여러 번 설정 변경 가능)
      removeAIBots(room);
      room.aiBotDifficulties = {};
      fillWithAIBotsIfNeeded(room, botDifficulties);

      cb({ ok: true });
      broadcastRoomState(io, room);
    });

    // ============================== room:toggle-spectator ==============================
    // 본인 또는 호스트가 다른 사용자를 player ↔ spectator 토글 (대기실 한정).
    // - player → spectator: 의도적 관전자(isGwangPali=false). 게임 종료 후에도 player 자동 복귀 X.
    // - spectator → player: 5명 미만일 때만. spectator가 광팔이였으면 그것도 자연스럽게 player로.
    socket.on('room:toggle-spectator', (payload, cb) => {
      const { userId, roomId } = socket.data;
      if (!userId || !roomId) return cb({ ok: false, error: '방에 입장하지 않음' });
      const room = roomStore.get(roomId);
      if (!room) return cb({ ok: false, error: '방을 찾을 수 없음' });
      if (room.phase !== 'waiting') {
        return cb({ ok: false, error: '대기실에서만 변경 가능' });
      }

      const targetUserId = payload?.targetUserId ?? userId;
      // 다른 사용자 토글은 호스트만
      if (targetUserId !== userId && room.hostId !== userId) {
        return cb({ ok: false, error: '호스트만 다른 사용자를 변경 가능' });
      }

      const player = room.players.find((p) => p.id === targetUserId);
      const spectator = room.spectators.find((s) => s.id === targetUserId);

      if (player) {
        // player → spectator
        // 호스트는 본인 강제 spectator 금지 — 게임 시작자가 없어짐
        if (targetUserId === room.hostId) {
          return cb({ ok: false, error: '호스트는 관전자로 전환 불가 (먼저 위임)' });
        }
        // 봇은 spectator 의미 없음 — 그냥 player에서 제거 + aiBotDifficulties 정리
        if (isAIBot(targetUserId)) {
          room.players = room.players.filter((p) => p.id !== targetUserId);
          if (room.aiBotDifficulties && targetUserId in room.aiBotDifficulties) {
            const next = { ...room.aiBotDifficulties };
            delete next[targetUserId];
            room.aiBotDifficulties = next;
          }
          cb({ ok: true });
          broadcastRoomState(io, room);
          return;
        }
        room.players = room.players.filter((p) => p.id !== targetUserId);
        room.spectators.push({
          id: player.id,
          nickname: player.nickname,
          emojiAvatar: player.emojiAvatar,
          joinedAt: Date.now(),
          connected: player.connected,
          isGwangPali: false,
        });
        // 광팔이 자원/지정에서도 제거 (player가 아니니 무의미)
        room.gwangPaliVolunteers = room.gwangPaliVolunteers.filter(
          (id) => id !== targetUserId,
        );
        room.gwangPaliAssignments = room.gwangPaliAssignments.filter(
          (id) => id !== targetUserId,
        );
        cb({ ok: true });
        broadcastRoomState(io, room);
        return;
      }

      if (spectator) {
        // spectator → player
        if (room.players.length >= 5) {
          return cb({ ok: false, error: '플레이어가 이미 5명 (자리 없음)' });
        }
        room.spectators = room.spectators.filter((s) => s.id !== targetUserId);
        room.players.push({
          id: spectator.id,
          nickname: spectator.nickname,
          emojiAvatar: spectator.emojiAvatar,
          hand: [],
          collected: [],
          score: 0,
          goCount: 0,
          flags: { shookMonths: [], bombs: 0, ppeoksCaused: 0, consecutiveAutoTurns: 0 },
          connected: spectator.connected,
        });
        cb({ ok: true });
        broadcastRoomState(io, room);
        return;
      }

      cb({ ok: false, error: '대상을 찾을 수 없음' });
    });

    // ============================== game:start ==============================
    socket.on('game:start', (payload, cb) => {
      const { userId, roomId } = socket.data;
      if (!userId || !roomId) return cb({ ok: false, error: '방에 입장하지 않음' });

      const room = roomStore.get(roomId);
      if (!room) return cb({ ok: false, error: '방을 찾을 수 없음' });

      const parsed = GameStartSchema.safeParse(payload ?? {});
      if (!parsed.success) {
        return cb({ ok: false, error: '잘못된 게임 시작 옵션' });
      }
      const { botDifficulties, testMode } = parsed.data;
      // testMode는 room에 영구 저장 — return-to-lobby 후 다시 시작해도 같은 모드
      if (testMode !== undefined) room.testMode = testMode;

      if (room.hostId !== userId) {
        return cb({ ok: false, error: '호스트만 게임을 시작할 수 있습니다' });
      }
      if (room.phase === 'playing') {
        return cb({ ok: false, error: '이미 게임이 진행 중입니다' });
      }
      if (room.players.length < 1 || room.players.length > 5) {
        return cb({
          ok: false,
          error: `플레이어 1~5명 필요 (현재 ${room.players.length}명)`,
        });
      }

      // 호스트가 명시한 봇 인원/난이도 적용. 없으면 player 1명일 때 medium 1명 자동 (B.19)
      fillWithAIBotsIfNeeded(room, botDifficulties);

      // nagariMultiplier는 보존 — 이전 판 누적이 그대로 다음 판에 반영. 첫 판은 createRoom에서 1.
      startGameInRoom(room);

      cb({ ok: true });
      scheduleAutoTurnTimer(io, room, roomStore);
      broadcastRoomState(io, room);
      progressAITurnIfAny(io, room, roomStore);
    });

    // ============================== game:declare-shodang ==============================
    // 쇼당 선언 — 본인 턴에 즉시 나가리 처리 (rules-final.md §7).
    // 친구간 협의 룰 — 자동 검증 X. 본인 턴에서만 호출 가능.
    socket.on('game:declare-shodang', (cb) => {
      const { userId, roomId } = socket.data;
      if (!userId || !roomId) return cb({ ok: false, error: '방에 입장하지 않음' });
      const room = roomStore.get(roomId);
      if (!room) return cb({ ok: false, error: '방을 찾을 수 없음' });
      if (!room.game) return cb({ ok: false, error: '게임이 진행 중이 아님' });
      if (room.phase !== 'playing') {
        return cb({ ok: false, error: '게임 진행 중에만 선언 가능' });
      }
      if (room.game.turnPlayerId !== userId) {
        return cb({ ok: false, error: '본인 턴에만 선언 가능' });
      }

      // 즉시 나가리 — 다음 판 ×2 누적
      room.nagariMultiplier = (room.nagariMultiplier ?? 1) * 2;
      room.phase = 'ended';
      cb({ ok: true });
      broadcastRoomState(io, room);
    });

    // ============================== room:return-to-lobby ==============================
    // 호스트가 게임 종료 후 대기실로 복귀. 다음 판 시작 전 봇/룰/멤버 재조정 기회 제공.
    // nagariMultiplier는 보존 — 직전 판 누적이 다음 판에 그대로 전달.
    socket.on('room:return-to-lobby', (cb) => {
      const { userId, roomId } = socket.data;
      if (!userId || !roomId) return cb({ ok: false, error: '방에 입장하지 않음' });

      const room = roomStore.get(roomId);
      if (!room) return cb({ ok: false, error: '방을 찾을 수 없음' });

      if (room.hostId !== userId) {
        return cb({ ok: false, error: '호스트만 대기실 복귀 가능' });
      }
      if (room.phase !== 'ended') {
        return cb({ ok: false, error: '게임 종료(ended) 상태에서만 가능' });
      }

      // 광팔이(isGwangPali=true) spectator → player 복귀. 의도적 spectator는 유지.
      reconvertSpectatorsToPlayers(room);

      room.game = null;
      room.stuckOwners = {};
      room.chongtongUserId = null;
      room.phase = 'waiting';
      // turn timer 잔여 정리
      if (room.turnTimerRef) {
        clearTimeout(room.turnTimerRef);
        room.turnTimerRef = undefined;
      }

      cb({ ok: true });
      broadcastRoomState(io, room);
    });

    // ============================== room:my-current ==============================
    // 사용자가 멤버인 방 조회 (한 사용자 한 방 정책상 0~1개).
    // 로비 mount 시 호출 → 응답에 방 있으면 "이전 방으로 돌아가기" 배너 노출.
    socket.on('room:my-current', (payload, cb) => {
      const queryUserId = payload?.userId;
      if (!queryUserId) return cb({ ok: false, error: 'userId 누락' });

      for (const r of roomStore.list()) {
        if (!isMember(r, queryUserId)) continue;
        const host =
          r.players.find((p) => p.id === r.hostId) ??
          r.spectators.find((s) => s.id === r.hostId);
        return cb({
          ok: true,
          data: {
            room: {
              id: r.id,
              hostNickname: host?.nickname ?? '???',
              hostEmoji: host?.emojiAvatar ?? '👤',
              playerCount: r.players.length,
              spectatorCount: r.spectators.length,
              maxPlayers: r.maxPlayers,
              phase: r.phase,
              hasPassword: !!r.password,
              createdAt: r.createdAt,
            },
          },
        });
      }
      cb({ ok: true, data: { room: null } });
    });

    // ============================== room:kick ==============================
    socket.on('room:kick', (payload, cb) => {
      const { userId, roomId } = socket.data;
      if (!userId || !roomId) return cb({ ok: false, error: '방에 입장하지 않음' });

      const room = roomStore.get(roomId);
      if (!room) return cb({ ok: false, error: '방을 찾을 수 없음' });

      if (room.hostId !== userId) {
        return cb({ ok: false, error: '호스트만 강퇴 가능' });
      }
      if (room.phase !== 'waiting') {
        return cb({ ok: false, error: '대기실에서만 강퇴 가능' });
      }

      const parsed = TargetUserSchema.safeParse(payload);
      if (!parsed.success) return cb({ ok: false, error: '입력 검증 실패' });
      const { targetUserId } = parsed.data;

      if (targetUserId === userId) {
        return cb({ ok: false, error: '본인은 강퇴할 수 없음' });
      }
      if (!isMember(room, targetUserId)) {
        return cb({ ok: false, error: '대상이 방의 멤버가 아님' });
      }

      // 대상에게 알림 (봇은 socket 없어 무시됨, 사람 사용자만 받음)
      io.to(userRoom(targetUserId)).emit('room:closed', {
        reason: '호스트가 강퇴했습니다',
      });

      removeMember(room, targetUserId);
      // 봇 강퇴 시 aiBotDifficulties도 정리 — 다음 게임 fillWithAIBotsIfNeeded fallback에서
      // 강퇴된 봇이 자동 재합류하지 않도록.
      if (room.aiBotDifficulties && targetUserId in room.aiBotDifficulties) {
        const next = { ...room.aiBotDifficulties };
        delete next[targetUserId];
        room.aiBotDifficulties = next;
      }
      cb({ ok: true });
      broadcastRoomState(io, room);
    });

    // ============================== room:update-rules ==============================
    // 룰 변경은 대기실(waiting) 또는 ended 단계에서만. 게임 중(playing) 변경은
    // 진행 중 점수/시간/타이머에 즉시 영향을 미쳐 불공정 시비가 생기므로 차단.
    socket.on('room:update-rules', (payload, cb) => {
      const { userId, roomId } = socket.data;
      if (!userId || !roomId) return cb({ ok: false, error: '방에 입장하지 않음' });

      const room = roomStore.get(roomId);
      if (!room) return cb({ ok: false, error: '방을 찾을 수 없음' });

      if (room.hostId !== userId) {
        return cb({ ok: false, error: '호스트만 룰 변경 가능' });
      }
      if (room.phase === 'playing') {
        return cb({ ok: false, error: '게임 진행 중에는 룰을 변경할 수 없습니다' });
      }

      const parsed = UpdateRulesSchema.safeParse(payload);
      if (!parsed.success) return cb({ ok: false, error: '입력 검증 실패' });

      // 실제로 변경된 키만 추려서 broadcast (toast 노이즈 방지)
      const changes: Partial<typeof room.rules> = {};
      for (const [k, v] of Object.entries(parsed.data.rules)) {
        if (v === undefined) continue;
        const key = k as keyof typeof room.rules;
        if (room.rules[key] !== v) {
          (changes as Record<string, unknown>)[key] = v;
        }
      }

      room.rules = { ...room.rules, ...parsed.data.rules };
      cb({ ok: true });

      if (Object.keys(changes).length > 0) {
        const host =
          room.players.find((p) => p.id === room.hostId) ??
          room.spectators.find((s) => s.id === room.hostId);
        io.to(gameRoom(room.id)).emit('room:rules-changed', {
          byNickname: host?.nickname ?? '호스트',
          changes,
        });
      }
      broadcastRoomState(io, room);
    });

    // ============================== room:transfer-host ==============================
    socket.on('room:transfer-host', (payload, cb) => {
      const { userId, roomId } = socket.data;
      if (!userId || !roomId) return cb({ ok: false, error: '방에 입장하지 않음' });

      const room = roomStore.get(roomId);
      if (!room) return cb({ ok: false, error: '방을 찾을 수 없음' });

      if (room.hostId !== userId) {
        return cb({ ok: false, error: '호스트만 위임 가능' });
      }
      if (room.phase !== 'waiting') {
        return cb({ ok: false, error: '대기실에서만 위임 가능' });
      }

      const parsed = TargetUserSchema.safeParse(payload);
      if (!parsed.success) return cb({ ok: false, error: '입력 검증 실패' });
      const { targetUserId } = parsed.data;

      if (targetUserId === userId) {
        return cb({ ok: false, error: '본인에게 위임할 수 없음' });
      }
      if (!isMember(room, targetUserId)) {
        return cb({ ok: false, error: '대상이 방의 멤버가 아님' });
      }

      room.hostId = targetUserId;
      cb({ ok: true });
      broadcastRoomState(io, room);
    });

    // ============================== game:action ==============================
    socket.on('game:action', (payload, cb) => {
      const { userId, roomId } = socket.data;
      if (!userId || !roomId) return cb({ ok: false, error: '방에 입장하지 않음' });

      const room = roomStore.get(roomId);
      if (!room) return cb({ ok: false, error: '방을 찾을 수 없음' });
      if (!room.game) return cb({ ok: false, error: '게임이 시작되지 않았습니다' });
      if (room.phase !== 'playing') {
        return cb({ ok: false, error: '플레이 단계가 아닙니다' });
      }

      const parsed = GameActionSchema.safeParse(payload);
      if (!parsed.success) return cb({ ok: false, error: '잘못된 액션' });
      const action = parsed.data;

      // Phase 2: play-card만 지원. 나머지는 Phase 4에서.
      if (action.type !== 'play-card') {
        return cb({ ok: false, error: `${action.type}는 Phase 4에서 지원 예정` });
      }

      if (room.game.turnPlayerId !== userId) {
        return cb({ ok: false, error: '본인 턴이 아닙니다' });
      }

      const player = findPlayer(room, userId);
      if (!player) return cb({ ok: false, error: '플레이어를 찾을 수 없음' });

      try {
        const result = playCardForPlayer(
          io,
          room,
          roomStore,
          userId,
          {
            cardId: action.cardId,
            targetAfterHand: action.targetAfterHand,
            targetAfterDraw: action.targetAfterDraw,
          },
          false,
        );
        if (!result.ok) {
          if ('needsSelection' in result) {
            return cb({ ok: false, needsSelection: result.needsSelection });
          }
          return cb({ ok: false, error: result.error });
        }
        cb({ ok: true });
      } catch (e) {
        cb({
          ok: false,
          error: e instanceof Error ? e.message : '알 수 없는 에러',
        });
      }
    });

    // ============================== disconnect ==============================
    // disconnect 동작:
    // - phase='playing': connected=false 마킹 + reconnect 대기 (rejoin 가능)
    // - phase='waiting' or 'ended': WAITING_DISCONNECT_GRACE 후 자동 removeMember
    //   (대기실에서 사라진 사용자가 자리 차지 X). 호스트면 자동 위임은 removeMember가 처리.
    socket.on('disconnect', (reason) => {
      console.log(`[socket] disconnected: ${socket.id} (${reason})`);
      const { userId, roomId } = socket.data;
      if (!userId || !roomId) return;

      const room = roomStore.get(roomId);
      if (!room) return;

      const found = setMemberConnected(room, userId, false);
      if (!found) return;

      io.to(gameRoom(roomId)).emit('room:player-disconnected', { userId });
      broadcastRoomState(io, room);

      // 대기실/종료 단계 disconnect는 짧은 grace 후 자동 제거 — reload(1~2초)는 가려주고
      // 명시적 탭 닫기는 빠르게 호스트 view에서 사라지도록.
      if (room.phase === 'waiting' || room.phase === 'ended') {
        const WAITING_DISCONNECT_GRACE_MS = 2_500;
        setTimeout(() => {
          const r = roomStore.get(roomId);
          if (!r) return;
          if (r.phase === 'playing') return;
          const stillMember =
            r.players.find((p) => p.id === userId) ??
            r.spectators.find((s) => s.id === userId);
          if (!stillMember || stillMember.connected) return;

          const { empty } = removeMember(r, userId);
          if (empty) {
            roomStore.delete(roomId);
          } else {
            broadcastRoomState(io, r);
          }
        }, WAITING_DISCONNECT_GRACE_MS);
      }
    });
  });
}
