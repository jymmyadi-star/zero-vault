import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config.js';

let supabaseAnonClient: SupabaseClient | null = null;

export function getSupabaseForUser(userJwt: string): SupabaseClient {
  return createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${userJwt}`,
      },
    },
  });
}

export function getSupabaseAnon(): SupabaseClient {
  if (!supabaseAnonClient) {
    supabaseAnonClient = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabaseAnonClient;
}

export async function verifyJwt(jwt: string): Promise<{ id: string; email: string | null; isAnonymous: boolean } | null> {
  const supabase = getSupabaseAnon();
  const { data, error } = await supabase.auth.getUser(jwt);

  if (error || !data.user) return null;

  return {
    id: data.user.id,
    email: data.user.email || null,
    isAnonymous: data.user.user_metadata?.is_anonymous === true,
  };
}

export async function signInAnonymous(): Promise<{ session: { access_token: string; refresh_token: string; expires_in: number }; user: { id: string } }> {
  const supabase = getSupabaseAnon();
  const email = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 8)}@anonymous.local`;
  const password = crypto.randomUUID();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { is_anonymous: true },
    },
  });

  if (error || !data.user) {
    throw new Error('Anonymous sign-in failed');
  }

  if (!data.session) {
    throw new Error('Anonymous sign-in failed: no session returned');
  }

  return {
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
    },
    user: { id: data.user.id },
  };
}
