/**
 * Supabase 클라이언트 — 익명 사용자 ID(localStorage)로 게임 히스토리 cross-device sync.
 *
 * - 현재는 Auth 안 씀. anon key + RLS로 read/write 허용.
 * - 추후 Supabase Auth(Anonymous 또는 Social) 도입 시 auth.uid() 기반 RLS로 강화.
 * - env 미설정 시 client는 null. gameHistoryStore가 fallback으로 localStorage만 사용.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  URL && KEY ? createClient(URL, KEY) : null;

export const supabaseEnabled = supabase !== null;

if (!supabase && import.meta.env.DEV) {
  console.warn(
    '[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 미설정 — localStorage fallback only',
  );
}
