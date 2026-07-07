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
  try {
    const supabase = getSupabaseAnon();
    const { data, error } = await supabase.auth.getUser(jwt);

    if (error || !data.user) return null;

    return {
      id: data.user.id,
      email: data.user.email || null,
      isAnonymous: data.user.user_metadata?.is_anonymous === true,
    };
  } catch (err) {
    return null;
  }
}

export async function signInDeterministic(email: string, password: string): Promise<{ session: { access_token: string; refresh_token: string; expires_in: number }; user: { id: string } }> {
  const supabase = getSupabaseAnon();

  // Try sign-up first — if the user already exists, Supabase returns an error.
  // Catch it and sign in instead.
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (signUpData?.session) {
    return {
      session: {
        access_token: signUpData.session.access_token,
        refresh_token: signUpData.session.refresh_token,
        expires_in: signUpData.session.expires_in,
      },
      user: { id: signUpData.user!.id },
    };
  }

  // User already exists — sign in
  if (signUpError && (signUpError.status === 400 || signUpError.message?.includes('already') || signUpError.message?.includes('registered'))) {
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError || !signInData.session) {
      throw new Error('Deterministic sign-in failed: ' + (signInError?.message || 'no session'));
    }
    return {
      session: {
        access_token: signInData.session.access_token,
        refresh_token: signInData.session.refresh_token,
        expires_in: signInData.session.expires_in,
      },
      user: { id: signInData.user!.id },
    };
  }

  throw new Error('Deterministic sign-in failed: ' + (signUpError?.message || 'unknown'));
}
