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
  if (error || !data) {
    console.warn('[auth] fetchDbProfile failed:', error?.message);
    return null;
  }
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
  if (error || !data) {
    console.error('[auth] upsertDbProfile failed:', error?.message);
    return null;
  }
  return data as DbProfile;
}

/** 앱 시작 시 1회 호출 — Supabase 세션 복원 + onAuthStateChange 리스너 등록 */
export function initAuth(): void {
  console.log('[auth] initAuth called, supabase:', supabase ? 'OK' : 'NULL');
  console.log('[auth] URL hash:', window.location.hash.slice(0, 50) + '...');

  if (!supabase) {
    console.warn('[auth] supabase is null — skipping auth init');
    useAuthStore.getState().setInitialized();
    return;
  }

  // onAuthStateChange를 먼저 등록 — hash fragment 처리 결과를 받기 위해
  supabase.auth.onAuthStateChange((event, session) => {
    console.log('[auth] onAuthStateChange:', event, 'session:', session ? `user=${session.user.id}` : 'null');
    useAuthStore.getState().setSession(session);
    if (session?.user) {
      void fetchDbProfile(session.user.id).then((profile) => {
        console.log('[auth] dbProfile loaded:', profile ? profile.nickname : 'null');
        useAuthStore.getState().setDbProfile(profile);
        // INITIAL_SESSION 또는 SIGNED_IN에서 initialized 설정
        if (!useAuthStore.getState().initialized) {
          useAuthStore.getState().setInitialized();
        }
      });
    } else {
      useAuthStore.getState().setDbProfile(null);
      if (!useAuthStore.getState().initialized) {
        useAuthStore.getState().setInitialized();
      }
    }
  });

  // fallback — onAuthStateChange가 5초 내 initialized 안 하면 강제 설정
  setTimeout(() => {
    if (!useAuthStore.getState().initialized) {
      console.warn('[auth] timeout — forcing initialized');
      useAuthStore.getState().setInitialized();
    }
  }, 5000);
}
