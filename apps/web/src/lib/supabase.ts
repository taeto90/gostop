import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  URL && KEY
    ? createClient(URL, KEY, {
        auth: {
          flowType: 'implicit',
          detectSessionInUrl: true,
        },
      })
    : null;

export const supabaseEnabled = supabase !== null;

if (!supabase && import.meta.env.DEV) {
  console.warn(
    '[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 미설정 — localStorage fallback only',
  );
}
