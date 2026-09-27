import { Logger } from '../logger';
import { supabase } from '../supabase';

const API_URL = (() => {
  const url = (process.env as any).EXPO_PUBLIC_SUPABASE_URL
    || 'https://ipmlypfufuntffgttldl.supabase.co';
  return url;
})();

// Map legacy API paths to Supabase Edge Functions
function toFunctionUrl(apiPath: string): string {
  const mapping: Record<string, string> = {
    '/auth/session': '/functions/v1/auth-signin',
    '/auth/signin': '/functions/v1/auth-signin',
    '/sync/push': '/functions/v1/sync-push',
    '/sync/pull': '/functions/v1/sync-pull',
    '/vault/seed': '/functions/v1/vault-seed',
  };
  // Handle /vault/seed/pair/:id
  if (apiPath.startsWith('/vault/seed/pair/')) {
    const pairingId = apiPath.replace('/vault/seed/pair/', '');
    return `/functions/v1/pairing/${pairingId}`;
  }
  return mapping[apiPath] || apiPath;
}

let cachedToken: string | null = null;
let cachedTokenExpiresAt: number = 0;
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000; // refresh 5 minutes before expiry

// Minimal UTF-8 decode (no `TextDecoder`/`atob` in React Native/Hermes).
function bytesToUtf8(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i]!;
    if (b < 0x80) {
      out += String.fromCharCode(b);
      i += 1;
    } else if (b < 0xe0) {
      out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i + 1]! & 0x3f));
      i += 2;
    } else if (b < 0xf0) {
      out += String.fromCharCode(
        ((b & 0x0f) << 12) | ((bytes[i + 1]! & 0x3f) << 6) | (bytes[i + 2]! & 0x3f),
      );
      i += 3;
    } else {
      const cp = ((b & 0x07) << 18) | ((bytes[i + 1]! & 0x3f) << 12) | ((bytes[i + 2]! & 0x3f) << 6) | (bytes[i + 3]! & 0x3f);
      out += String.fromCodePoint(cp);
      i += 4;
    }
  }
  return out;
}

// Base64url decode (React Native/Hermes has no global `atob`).
function base64UrlToBytes(input: string): Uint8Array {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const bytes = new Uint8Array((padded.length * 3) / 4);
  let outIdx = 0;
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < padded.length; i++) {
    const c = padded[i]!;
    if (c === '=') break;
    let val: number;
    const code = c.charCodeAt(0);
    if (code >= 65 && code <= 90) val = code - 65;
    else if (code >= 97 && code <= 122) val = code - 97 + 26;
    else if (code >= 48 && code <= 57) val = code - 48 + 52;
    else if (c === '+') val = 62;
    else if (c === '/') val = 63;
    else continue;
    buffer = (buffer << 6) | val;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[outIdx++] = (buffer >> bits) & 0xff;
    }
  }
  return bytes.subarray(0, outIdx);
}

function decodeJwtExp(token: string): number {
  try {
    const payload = token.split('.')[1];
    if (!payload) return 0;
    const decoded = JSON.parse(bytesToUtf8(base64UrlToBytes(payload)));
    return (decoded.exp || 0) * 1000; // convert to ms
  } catch {
    return 0;
  }
}

export async function getAccessToken(): Promise<string | null> {
  if (cachedToken && Date.now() < cachedTokenExpiresAt - TOKEN_REFRESH_MARGIN_MS) {
    return cachedToken;
  }

  cachedToken = null;
  cachedTokenExpiresAt = 0;

  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) {
        cachedToken = data.session.access_token;
        cachedTokenExpiresAt = decodeJwtExp(cachedToken);
        if (cachedTokenExpiresAt === 0) {
          // If we can't decode exp, set a short TTL to force refresh
          cachedTokenExpiresAt = Date.now() + 60 * 60 * 1000;
        }
        return cachedToken;
      }
    } catch {}
  }

  return null;
}

function invalidateToken(): void {
  cachedToken = null;
  cachedTokenExpiresAt = 0;
}

async function apiFetch<T>(
  path: string,
  options: { method?: 'GET' | 'POST' | 'DELETE' | 'HEAD'; body?: unknown; query?: Record<string, string>; isRetry?: boolean } = {},
): Promise<T> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('NOT_AUTHENTICATED: No valid session');
  }

  let url = `${API_URL}${toFunctionUrl(path)}`;
  if (options.query) {
    const params = new URLSearchParams(options.query).toString();
    url += `?${params}`;
  }

  const supabaseKey = (process.env as any).EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    apikey: supabaseKey || '',
  };

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 401 && !options.isRetry) {
    invalidateToken();
    if (supabase) {
      try {
        const { data, error } = await supabase.auth.refreshSession();
        if (!error && data.session) {
          cachedToken = data.session.access_token;
          cachedTokenExpiresAt = decodeJwtExp(cachedToken);
          return apiFetch(path, { ...options, isRetry: true });
        }
      } catch {}
    }
    throw new Error('UNAUTHORIZED: Session expired');
  } else if (response.status === 401) {
    throw new Error('UNAUTHORIZED: Session expired');
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(errorBody.message || `HTTP ${response.status}`);
  }

  if (options.method === 'HEAD') {
    return undefined as T;
  }

  return response.json();
}

interface PushChange {
  entityId: string;
  entityType: 'vaultItem';
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  payloadCiphertext: string;
  newRevision: string | null;
  keyEpochId: number;
  hlc: string;
}

interface PushResult {
  accepted: number;
  rejected: number;
}

interface PullResult {
  logs: any[];
  hasMore: boolean;
  lastId: number;
}

interface VaultSeedData {
  deviceSalt: string;
  wrappedVaultKey: string;
  wrappedCipherKey: string;
  wrappedSignKey: string;
  pinVerifySalt: string;
  pinVerifyHash: string;
  seedMac?: string;
  pairingId?: string;
  updatedAt?: string;
}

export const apiClient = {
  setUrl(url: string): void {
    if (!__DEV__) {
      Logger.warn('[Security] apiClient.setUrl blocked in production', { module: 'ApiClient' });
      return;
    }
    (globalThis as any).__socler_api_url = url;
  },

  getUrl(): string {
    return (globalThis as any).__socler_api_url || API_URL;
  },

  async push(changes: PushChange[]): Promise<PushResult> {
    return apiFetch('/sync/push', {
      method: 'POST',
      body: { changes },
    });
  },

  async pull(sinceId: number, pageSize: number = 200): Promise<PullResult> {
    return apiFetch('/sync/pull', {
      query: { sinceId: sinceId.toString(), pageSize: pageSize.toString() },
    });
  },

  async pushVaultSeed(seed: VaultSeedData): Promise<{ success: boolean }> {
    return apiFetch('/vault/seed', {
      method: 'POST',
      body: seed,
    });
  },

  async pullVaultSeed(): Promise<VaultSeedData | null> {
    return apiFetch('/vault/seed');
  },

  async deleteVaultSeed(): Promise<{ success: boolean }> {
    return apiFetch('/vault/seed', { method: 'DELETE' });
  },
};
