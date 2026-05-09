/**
 * Socket.io broadcast helpers — handlers.ts + aiTurn.ts에서 공유.
 */

import type { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  Room,
  ServerToClientEvents,
} from '@gostop/shared';
import { buildRoomView } from './views.ts';

export interface SocketData {
  userId?: string;
  roomId?: string;
}

export type IO = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

export const userRoom = (userId: string) => `user:${userId}`;
export const gameRoom = (roomId: string) => `room:${roomId}`;

/** 방의 모든 멤버에게 RoomView 전송 (각 멤버 시점) */
export function broadcastRoomState(io: IO, room: Room): void {
  const members = [...room.players, ...room.spectators];
  for (const member of members) {
    const view = buildRoomView(room, member.id);
    io.to(userRoom(member.id)).emit('room:state', view);
  }
}
