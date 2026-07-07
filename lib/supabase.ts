import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { Logger } from './logger';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;


import AsyncStorage from '@react-native-async-storage/async-storage';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabaseUrl.length > 0 && supabaseAnonKey && supabaseAnonKey.length > 0,
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
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
