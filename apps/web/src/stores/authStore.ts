import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase.ts';

export interface DbProfile {
  id: string;
  nickname: string;
  emoji_avatar: string;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  dbProfile: DbProfile | null;
  loading: boolean;
  /** 초기 세션 복원 완료 여부 */
  initialized: boolean;

  setSession: (session: Session | null) => void;
  setDbProfile: (profile: DbProfile | null) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: () => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  dbProfile: null,
  loading: false,
  initialized: false,

  setSession: (session) =>
    set({ session, user: session?.user ?? null }),

  setDbProfile: (profile) => set({ dbProfile: profile }),
  setLoading: (loading) => set({ loading }),
  setInitialized: () => set({ initialized: true }),

  signOut: async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    set({ session: null, user: null, dbProfile: null });
  },
}));

export async function fetchDbProfile(userId: string): Promise<DbProfile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nickname, emoji_avatar')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  return data as DbProfile;
}

export async function upsertDbProfile(
  userId: string,
  nickname: string,
  emojiAvatar: string,
): Promise<DbProfile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      { id: userId, nickname, emoji_avatar: emojiAvatar },
      { onConflict: 'id' },
    )
    .select('id, nickname, emoji_avatar')
    .single();
  if (error || !data) return null;
  return data as DbProfile;
}

/** 앱 시작 시 1회 호출 — Supabase 세션 복원 + onAuthStateChange 리스너 등록 */
export function initAuth(): void {
  if (!supabase) {
    useAuthStore.getState().setInitialized();
    return;
  }

  supabase.auth.getSession().then(({ data: { session } }) => {
    useAuthStore.getState().setSession(session);
    if (session?.user) {
      void fetchDbProfile(session.user.id).then((profile) => {
        useAuthStore.getState().setDbProfile(profile);
        useAuthStore.getState().setInitialized();
      });
    } else {
      useAuthStore.getState().setInitialized();
    }
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    useAuthStore.getState().setSession(session);
    if (session?.user) {
      void fetchDbProfile(session.user.id).then((profile) => {
        useAuthStore.getState().setDbProfile(profile);
      });
    } else {
      useAuthStore.getState().setDbProfile(null);
    }
  });
}
