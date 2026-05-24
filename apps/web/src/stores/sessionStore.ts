import { create } from 'zustand';

export interface Profile {
  userId: string;
  nickname: string;
  emojiAvatar: string;
}

interface SessionState {
  profile: Profile | null;
  setProfile: (profile: Profile) => void;
  clearProfile: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  profile: null,
  setProfile: (profile) => set({ profile }),
  clearProfile: () => set({ profile: null }),
}));
