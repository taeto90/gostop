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

console.log('[supabase] client:', supabase ? 'created' : 'NULL', 'URL:', URL ? URL.slice(0, 30) + '...' : 'empty', 'KEY:', KEY ? KEY.slice(0, 10) + '...' : 'empty');

if (!supabase && import.meta.env.DEV) {
  console.warn(
    '[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 미설정 — localStorage fallback only',
  );
}
