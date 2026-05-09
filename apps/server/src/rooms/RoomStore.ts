import type { Room } from '@gostop/shared';

export interface CreateRoomOptions {
  hostId: string;
  maxPlayers?: 2 | 3 | 5;
}

export interface RoomStore {
  create(opts: CreateRoomOptions): Room;
  get(id: string): Room | undefined;
  delete(id: string): boolean;
  list(): Room[];
  size(): number;
}
