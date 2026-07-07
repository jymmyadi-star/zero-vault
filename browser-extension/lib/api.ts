import type { SyncLogEntry, PushChange, VaultSeedData } from './types';

let API_URL = 'https://ipmlypfufuntffgttldl.supabase.co';
let isApiUrlLoaded = false;

// Ambient declaration for build-time `process.env` injection (esbuild `define`)
declare const process: { env: Record<string, string | undefined> } | undefined;

// Async initialize API_URL for production (from build var or chrome storage)
export async function getApiUrl(): Promise<string> {
  // 1. Build-time injection (highest priority)
  if (typeof process !== 'undefined' && process?.env) {
    if (process.env.EXPO_PUBLIC_ZEROVAULT_API_URL) return process.env.EXPO_PUBLIC_ZEROVAULT_API_URL;
    if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  }
  
  if (isApiUrlLoaded) return API_URL;

  // 2. Runtime override via extension storage (for self-hosters)
  // if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
  //   return new Promise((resolve) => {
  //     chrome.storage.local.get(['ZEROVAULT_API_URL'], (result: Record<string, any>) => {
  //       if (typeof result.ZEROVAULT_API_URL === 'string') {
  //         API_URL = result.ZEROVAULT_API_URL;
  //       }
  //       isApiUrlLoaded = true;
  //       resolve(API_URL);
  //     });
  //   });
  // }

  isApiUrlLoaded = true;
  return API_URL; // Fallback to dev localhost
}

let cachedToken: string | null = null;

export function getToken(): string | null {
  return cachedToken;
}

export function setToken(token: string | null): void {
  cachedToken = token;
}

// Map API paths to Supabase Edge Function URLs
function apiPathToFunction(path: string): string {
  const mapping: Record<string, string> = {
    '/auth/session': '/functions/v1/auth-signin',
    '/sync/push': '/functions/v1/sync-push',
    '/sync/pull': '/functions/v1/sync-pull',
    '/vault/seed': '/functions/v1/vault-seed',
  };
  if (path.startsWith('/vault/seed/pair/')) {
    return `/functions/v1/pairing/${path.replace('/vault/seed/pair/', '')}`;
  }
  return mapping[path] || path;
}

async function apiFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; query?: Record<string, string> } = {},
): Promise<T> {
  const token = getToken();
  if (!token && !path.includes('/auth/signin')) {
    throw new Error('NOT_AUTHENTICATED');
  }

  const baseUrl = await getApiUrl();
  let url = `${baseUrl}${apiPathToFunction(path)}`;
  if (options.query) {
    url += '?' + new URLSearchParams(options.query).toString();
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }

  if (options.method === 'HEAD') return undefined as T;
  return res.json();
}

export const api = {
  async getSession(): Promise<{ id: string; email: string | null; isAnonymous: boolean }> {
    return apiFetch('/auth/session');
  },

  async signIn(email: string, password: string): Promise<{ accessToken: string }> {
    const baseUrl = await getApiUrl();
    const res = await fetch(`${baseUrl}/functions/v1/auth-signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
      throw new Error(`Server returned ${res.status}: ${err.message}`);
    }
    const data = await res.json();
    setToken(data.accessToken);
    return { accessToken: data.accessToken };
  },

  async pushVaultSeed(seed: VaultSeedData): Promise<{ success: boolean }> {
    return apiFetch('/vault/seed', { method: 'POST', body: seed });
  },

  async pullVaultSeed(): Promise<VaultSeedData | null> {
    return apiFetch('/vault/seed');
  },

  async pullSeedByPairing(pairingId: string): Promise<VaultSeedData | null> {
    try {
      return await apiFetch<VaultSeedData>(`/vault/seed/pair/${pairingId}`);
    } catch (e: any) {
      if (e.message?.includes('404')) return null;
      throw e;
    }
  },

  async push(changes: PushChange[]): Promise<{ accepted: number }> {
    return apiFetch('/sync/push', { method: 'POST', body: { changes } });
  },

  async pull(sinceId: number, pageSize = 200): Promise<{ logs: SyncLogEntry[]; hasMore: boolean; lastId: number }> {
    return apiFetch('/sync/pull', {
      query: { sinceId: String(sinceId), pageSize: String(pageSize) },
    });
  },

  async getSyncStatus(): Promise<{ lastId: number }> {
    return apiFetch('/sync/status');
  },
};
