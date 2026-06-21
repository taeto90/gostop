import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../lib/supabase.ts';

export interface DbProfile {
  id: string;
  nickname: string;
  emoji_avatar: string;
  email: string | null;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  dbProfile: DbProfile | null;
  initialized: boolean;

  setSession: (session: Session | null) => void;
  setDbProfile: (profile: DbProfile | null) => void;
  setInitialized: () => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  dbProfile: null,
  initialized: false,

  setSession: (session) =>
    set({ session, user: session?.user ?? null }),

  setDbProfile: (profile) => set({ dbProfile: profile }),
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
    .select('id, nickname, emoji_avatar, email')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  return data as DbProfile;
}

export async function upsertDbProfile(
  userId: string,
  nickname: string,
  emojiAvatar: string,
  email?: string,
): Promise<DbProfile | null> {
  if (!supabase) return null;
  const row: Record<string, unknown> = {
    id: userId,
    nickname,
    emoji_avatar: emojiAvatar,
  };
  if (email) row.email = email;
  const { data, error } = await supabase
    .from('profiles')
    .upsert(row, { onConflict: 'id' })
    .select('id, nickname, emoji_avatar, email')
    .single();
  if (error || !data) return null;
  return data as DbProfile;
}

/** URL fragment(#access_token=...&refresh_token=...) 에서 토큰 파싱. 웹 hash + 앱 deep-link 공용. */
function parseTokensFromHash(
  rawHash: string,
): { access_token: string; refresh_token: string } | null {
  const hash = rawHash.startsWith('#') ? rawHash.substring(1) : rawHash;
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) return null;
  return { access_token, refresh_token };
}

/**
 * Capacitor(Android 앱): OAuth 리다이렉트가 custom scheme deep-link로 돌아옴
 * (com.gostop.app://login-callback#access_token=...&refresh_token=...).
 * appUrlOpen 으로 받아 fragment 파싱 → setSession. 웹과 동일한 implicit 토큰 흐름 재사용.
 */
async function registerNativeAuthDeepLink(): Promise<void> {
  if (!supabase) return;
  const { App } = await import('@capacitor/app');
  const { Browser } = await import('@capacitor/browser');
  await App.addListener('appUrlOpen', ({ url }) => {
    const hashIndex = url.indexOf('#');
    if (hashIndex === -1) return;
    const tokens = parseTokensFromHash(url.substring(hashIndex));
    if (!tokens) return;
    void Browser.close().catch(() => {});
    void supabase!.auth.setSession(tokens).then(({ data }) => {
      void applySession(data.session);
    });
  });
}

async function applySession(session: Session | null): Promise<void> {
  const store = useAuthStore.getState();
  store.setSession(session);
  if (session?.user) {
    store.setDbProfile(await fetchDbProfile(session.user.id));
  } else {
    store.setDbProfile(null);
  }
  if (!useAuthStore.getState().initialized) {
    store.setInitialized();
  }
}

export function initAuth(): void {
  if (!supabase) {
    useAuthStore.getState().setInitialized();
    return;
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    void applySession(session);
  });

  // 앱(Capacitor): deep-link OAuth 콜백 리스너 등록
  if (Capacitor.isNativePlatform()) {
    void registerNativeAuthDeepLink();
  }

  // OAuth 리다이렉트 후 — URL hash에서 토큰 직접 파싱 + setSession (웹)
  const tokens = parseTokensFromHash(window.location.hash);
  if (tokens) {
    window.history.replaceState(null, '', window.location.pathname);
    supabase.auth.setSession(tokens).then(({ data }) => {
      void applySession(data.session);
    });
    return;
  }

  // 기존 세션 복원
  supabase.auth.getSession().then(({ data: { session } }) => {
    void applySession(session);
  });
}
