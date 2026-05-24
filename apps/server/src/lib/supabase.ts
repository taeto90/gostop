/**
 * Supabase 서버 클라이언트 — game_logs 테이블 쓰기 전용.
 *
 * - service_role key 사용 (RLS 우회). Railway env에만 등록, repo X.
 * - SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 미설정 시 null → 로그 저장 skip.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL ?? '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

export const supabaseAdmin: SupabaseClient | null =
  URL && SERVICE_KEY
    ? createClient(URL, SERVICE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

export const supabaseAdminEnabled = supabaseAdmin !== null;

if (!supabaseAdmin) {
  console.warn(
    '[supabase] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 미설정 — game_logs DB 저장 skip',
  );
}
