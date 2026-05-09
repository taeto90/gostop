import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Server as SocketServer } from 'socket.io';
import { z } from 'zod';
import type { ClientToServerEvents, ServerToClientEvents } from '@gostop/shared';

import { config } from './config.ts';
import { InMemoryRoomStore } from './rooms/InMemoryRoomStore.ts';
import { registerSocketHandlers } from './socket/handlers.ts';
import { generateLiveKitToken } from './livekit/token.ts';

// production에선 pino-pretty 비활성 (devDependency라 prod install 안 됨).
// dev에서만 colorized + translated time 로그.
const isProd = process.env.NODE_ENV === 'production';
const fastify = Fastify({
  logger: isProd
    ? { level: 'info' }
    : {
        level: 'info',
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss' },
        },
      },
});

await fastify.register(cors, {
  origin: config.CORS_ORIGIN,
  credentials: true,
});

const roomStore = new InMemoryRoomStore();

fastify.get('/health', async () => ({
  ok: true,
  uptime: Math.floor(process.uptime()),
  rooms: roomStore.size(),
  timestamp: Date.now(),
}));

// 진단용 — 현재 서버의 모든 방 상태 dump. NODE_ENV=production이 아닐 때만 노출.
if (process.env.NODE_ENV !== 'production') {
  fastify.get('/debug/rooms', async () => {
    return {
      timestamp: Date.now(),
      count: roomStore.size(),
      rooms: roomStore.list().map((r) => ({
        id: r.id,
        phase: r.phase,
        hostId: r.hostId,
        players: r.players.map((p) => ({
          id: p.id,
          nickname: p.nickname,
          connected: p.connected,
        })),
        spectators: r.spectators.map((s) => ({
          id: s.id,
          nickname: s.nickname,
          connected: s.connected,
          isGwangPali: s.isGwangPali,
        })),
        createdAt: r.createdAt,
      })),
    };
  });
}

const TokenRequestSchema = z.object({
  roomId: z.string().min(1),
  participantId: z.string().min(1),
  participantName: z.string().min(1).max(20),
  canPublish: z.boolean(),
  voiceOnly: z.boolean().optional(),
});

fastify.post('/api/livekit/token', async (request, reply) => {
  const parsed = TokenRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    reply.code(400);
    return { error: 'invalid request', details: parsed.error.format() };
  }
  try {
    const token = await generateLiveKitToken(parsed.data);
    return { token, livekitUrl: config.LIVEKIT_URL };
  } catch (err) {
    fastify.log.error(err, 'livekit token generation failed');
    reply.code(500);
    return { error: 'token generation failed' };
  }
});

await fastify.listen({ port: config.PORT, host: config.HOST });

// 방 자동 정리 cron — 1분마다 모든 멤버가 disconnected인 방을 삭제.
// disconnect 핸들러의 grace cleanup이 어떤 이유로 누락되어도 좀비 방 잔존 X.
// 매우 오래된 빈 phase=ended 방도 정리 (게임 끝난 후 모두 leave 안 한 케이스).
const ROOM_CLEANUP_INTERVAL_MS = 60_000;
const STALE_ENDED_THRESHOLD_MS = 30 * 60_000; // 30분
setInterval(() => {
  const now = Date.now();
  for (const room of roomStore.list()) {
    const allDisconnected =
      room.players.every((p) => !p.connected) &&
      room.spectators.every((s) => !s.connected);
    const isStaleEnded =
      room.phase === 'ended' && now - room.createdAt > STALE_ENDED_THRESHOLD_MS;

    if (allDisconnected || isStaleEnded) {
      fastify.log.info(
        { roomId: room.id, phase: room.phase, players: room.players.length },
        '[cleanup] 자동 정리 — 모든 멤버 disconnected 또는 stale ended',
      );
      // 진행 중인 turn timer도 정리
      if (room.turnTimerRef) {
        clearTimeout(room.turnTimerRef);
        room.turnTimerRef = undefined;
      }
      roomStore.delete(room.id);
    }
  }
}, ROOM_CLEANUP_INTERVAL_MS);

interface SocketData {
  userId?: string;
  roomId?: string;
}

const io = new SocketServer<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>(fastify.server, {
  cors: { origin: config.CORS_ORIGIN, credentials: true },
});

registerSocketHandlers(io, roomStore);

fastify.log.info(`socket.io ready (${io.engine.clientsCount} clients)`);

const shutdown = async (signal: string) => {
  fastify.log.info(`${signal} received, shutting down`);
  io.close();
  await fastify.close();
  process.exit(0);
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
