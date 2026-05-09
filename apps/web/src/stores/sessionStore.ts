import { create } from 'zustand';
import { getOrCreateUserId, loadProfile, saveProfile, type Profile } from '../lib/identity.ts';

interface SessionState {
  profile: Profile | null;
  setProfile: (data: { nickname: string; emojiAvatar: string }) => void;
  clearProfile: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  // 동기 초기화 — RoomScreen이 redirect하기 전에 localStorage 읽음
  profile: loadProfile(),

  setProfile: ({ nickname, emojiAvatar }) => {
    const userId = getOrCreateUserId();
    const profile: Profile = { userId, nickname: nickname.trim(), emojiAvatar };
    saveProfile(profile);
    set({ profile });
  },

  clearProfile: () => set({ profile: null }),
}));
