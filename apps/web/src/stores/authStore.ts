import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
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

function parseHashTokens(): { access_token: string; refresh_token: string } | null {
  const hash = window.location.hash.substring(1);
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) return null;
  return { access_token, refresh_token };
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

  // OAuth 리다이렉트 후 — URL hash에서 토큰 직접 파싱 + setSession
  const tokens = parseHashTokens();
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
