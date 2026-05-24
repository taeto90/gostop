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

/** URL hash에서 access_token + refresh_token 파싱 */
function parseHashTokens(): { access_token: string; refresh_token: string } | null {
  const hash = window.location.hash.substring(1);
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) return null;
  return { access_token, refresh_token };
}

async function handleSession(session: Session | null): Promise<void> {
  const store = useAuthStore.getState();
  store.setSession(session);
  if (session?.user) {
    const profile = await fetchDbProfile(session.user.id);
    console.log('[auth] dbProfile:', profile ? profile.nickname : 'null');
    store.setDbProfile(profile);
  } else {
    store.setDbProfile(null);
  }
  if (!useAuthStore.getState().initialized) {
    store.setInitialized();
  }
}

export function initAuth(): void {
  console.log('[auth] initAuth called, supabase:', supabase ? 'OK' : 'NULL');

  if (!supabase) {
    useAuthStore.getState().setInitialized();
    return;
  }

  // 이벤트 리스너 등록
  supabase.auth.onAuthStateChange((event, session) => {
    console.log('[auth] onAuthStateChange:', event);
    void handleSession(session);
  });

  // OAuth 리다이렉트 후 — URL hash에서 토큰 직접 파싱 + setSession
  const tokens = parseHashTokens();
  if (tokens) {
    console.log('[auth] found tokens in URL hash, setting session manually');
    window.history.replaceState(null, '', window.location.pathname);
    supabase.auth.setSession(tokens).then(({ data, error }) => {
      if (error) {
        console.error('[auth] setSession failed:', error.message);
      } else {
        console.log('[auth] setSession OK, user:', data.session?.user.id);
      }
      void handleSession(data.session);
    });
    return;
  }

  // 기존 세션 복원 시도
  supabase.auth.getSession().then(({ data: { session } }) => {
    console.log('[auth] getSession:', session ? `user=${session.user.id}` : 'null');
    void handleSession(session);
  });
}
