import type { SyncLogEntry, PushChange, VaultSeedData } from './types';

const API_URL = 'http://localhost:4000';

let cachedToken: string | null = null;

export function getToken(): string | null {
  return cachedToken;
}

export function setToken(token: string | null): void {
  cachedToken = token;
}

async function apiFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; query?: Record<string, string> } = {},
): Promise<T> {
  const token = getToken();
  if (!token && !path.includes('/auth/anonymous')) {
    throw new Error('NOT_AUTHENTICATED');
  }

  let url = `${API_URL}/api${path}`;
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
    // Use Supabase directly for sign-in since the API server proxies auth
    const res = await fetch(`${API_URL}/api/auth/anonymous`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error('Auth failed');
    const data = await res.json();
    setToken(data.accessToken);
    return { accessToken: data.accessToken };
  },

  async anonSignIn(): Promise<string> {
    const res = await fetch(`${API_URL}/api/auth/anonymous`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error('Anonymous sign-in failed');
    const data = await res.json();
    setToken(data.accessToken);
    return data.accessToken;
  },

  async pushVaultSeed(seed: VaultSeedData): Promise<{ success: boolean }> {
    return apiFetch('/vault/seed', { method: 'POST', body: seed });
  },

  async pullVaultSeed(): Promise<VaultSeedData | null> {
    return apiFetch('/vault/seed');
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
