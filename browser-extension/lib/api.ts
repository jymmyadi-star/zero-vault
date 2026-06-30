import type { SyncLogEntry, PushChange, VaultSeedData } from './types';

let API_URL = 'http://localhost:4000';
let isApiUrlLoaded = false;

// Async initialize API_URL for production (from build var or chrome storage)
async function getApiUrl(): Promise<string> {
  // 1. Build-time injection (highest priority)
  if (typeof process !== 'undefined' && process.env) {
    // @ts-ignore
    if (process.env.EXPO_PUBLIC_ZEROVAULT_API_URL) return process.env.EXPO_PUBLIC_ZEROVAULT_API_URL;
    // @ts-ignore
    if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  }
  
  if (isApiUrlLoaded) return API_URL;

  // 2. Runtime override via extension storage (for self-hosters)
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['ZEROVAULT_API_URL'], (result: Record<string, any>) => {
        if (typeof result.ZEROVAULT_API_URL === 'string') {
          API_URL = result.ZEROVAULT_API_URL;
        }
        isApiUrlLoaded = true;
        resolve(API_URL);
      });
    });
  }

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

async function apiFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; query?: Record<string, string> } = {},
): Promise<T> {
  const token = getToken();
  if (!token && !path.includes('/auth/anonymous')) {
    throw new Error('NOT_AUTHENTICATED');
  }

  const baseUrl = await getApiUrl();
  let url = `${baseUrl}/api${path}`;
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
    const res = await fetch(`${baseUrl}/api/auth/anonymous`, {
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
    const baseUrl = await getApiUrl();
    const res = await fetch(`${baseUrl}/api/auth/anonymous`, {
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

  async pullSeedByPairing(pairingId: string): Promise<VaultSeedData | null> {
    return apiFetch(`/vault/seed/pair/${pairingId}`);
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
