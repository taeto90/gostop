import type { Room } from '@gostop/shared';
import { defaultRoomRules } from '@gostop/shared';
import { generateRoomId } from '../utils/id.ts';
import type { CreateRoomOptions, RoomStore } from './RoomStore.ts';

export class InMemoryRoomStore implements RoomStore {
  private readonly rooms = new Map<string, Room>();

  create(opts: CreateRoomOptions): Room {
    let id = generateRoomId();
    while (this.rooms.has(id)) id = generateRoomId();

    const room: Room = {
      id,
      hostId: opts.hostId,
      players: [],
      spectators: [],
      maxPlayers: opts.maxPlayers ?? 3,
      phase: 'waiting',
      game: null,
      createdAt: Date.now(),
      gwangPaliVolunteers: [],
      gwangPaliAssignments: [],
      stuckOwners: {},
      nagariMultiplier: 1,
      chongtongUserId: null,
      rules: defaultRoomRules(),
    };
    this.rooms.set(id, room);
    return room;
  }

  get(id: string): Room | undefined {
    return this.rooms.get(id);
  }

  delete(id: string): boolean {
    return this.rooms.delete(id);
  }

  list(): Room[] {
    return Array.from(this.rooms.values());
  }

  size(): number {
    return this.rooms.size;
  }
}
