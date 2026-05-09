import { create } from 'zustand';
import type { RoomView } from '@gostop/shared';

interface RoomState {
  view: RoomView | null;
  error: string | null;
  setView: (view: RoomView) => void;
  setError: (error: string | null) => void;
  clear: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  view: null,
  error: null,
  setView: (view) => set({ view, error: null }),
  setError: (error) => set({ error }),
  clear: () => set({ view: null, error: null }),
}));
