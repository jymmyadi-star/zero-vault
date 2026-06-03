import { createClient } from '@supabase/supabase-js';
import { Logger } from './logger';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabaseUrl.length > 0 && supabaseAnonKey && supabaseAnonKey.length > 0,
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
      },
    })
  : null;

if (!isSupabaseConfigured) {
  Logger.info('[Supabase] Not configured — running in offline-only Paranoia Mode', {
    module: 'Supabase',
  });
} else {
  Logger.info('[Supabase] Client initialized — cloud sync available', { module: 'Supabase' });
}
