import { Logger } from '../logger';
import { supabase } from '../supabase';

const API_URL = process.env.ZEROVAULT_API_URL || 'http://localhost:4000';

let ws: any = null;
let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let listeners: Array<(type: string, data: any) => void> = [];

let cachedToken: string | null = null;

export async function getAccessToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;

  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) {
        cachedToken = data.session.access_token;
        return cachedToken;
      }
    } catch {}
  }

  return null;
}

function invalidateToken(): void {
  cachedToken = null;
}

async function apiFetch<T>(
  path: string,
  options: { method?: 'GET' | 'POST' | 'DELETE' | 'HEAD'; body?: unknown; query?: Record<string, string> } = {},
): Promise<T> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('NOT_AUTHENTICATED: No valid session');
  }

  let url = `${API_URL}/api${path}`;
  if (options.query) {
    const params = new URLSearchParams(options.query).toString();
    url += `?${params}`;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 401) {
    invalidateToken();
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

interface SyncStatusResult {
  lastId: number;
}

interface AuthResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  userId: string;
}

interface VaultSeedData {
  deviceSalt: string;
  wrappedVaultKey: string;
  wrappedCipherKey: string;
  wrappedSignKey: string;
  pinVerifyHash: string;
  updatedAt?: string;
}

export const apiClient = {
  setUrl(url: string): void {
    (globalThis as any).__zerovault_api_url = url;
  },

  getUrl(): string {
    return (globalThis as any).__zerovault_api_url || API_URL;
  },

  async anonymousSignIn(): Promise<AuthResult> {
    const url = `${this.getUrl()}/api/auth/anonymous`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: 'Failed' }));
      throw new Error(err.message || 'Anonymous sign-in failed');
    }

    return response.json();
  },

  async verifySession(): Promise<{ id: string; email: string | null; isAnonymous: boolean }> {
    return apiFetch('/auth/session');
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

  async getSyncStatus(): Promise<SyncStatusResult> {
    return apiFetch('/sync/status');
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

  async hasVaultSeed(): Promise<boolean> {
    try {
      await apiFetch<any>('/vault/seed', { method: 'HEAD' });
      return true;
    } catch {
      return false;
    }
  },
};

export function connectWebSocket(): void {
  disconnectWebSocket();

  getAccessToken().then((token) => {
    if (!token) return;

    const url = apiClient.getUrl().replace(/^http/, 'ws');
    const wsUrl = `${url}/ws?token=${encodeURIComponent(token)}`;

    try {
      ws = new (WebSocket as any)(wsUrl);

      ws.onopen = () => {
        Logger.info('WebSocket connected to API server', { module: 'ApiClient' });
        if (wsReconnectTimer) {
          clearTimeout(wsReconnectTimer);
          wsReconnectTimer = null;
        }
      };

      ws.onmessage = (event: any) => {
        try {
          const msg = JSON.parse(event.data as string);
          for (const listener of listeners) {
            listener(msg.type, msg.data);
          }
        } catch {}
      };

      ws.onclose = (event: any) => {
        Logger.info('WebSocket closed', { module: 'ApiClient', code: event?.code });
        ws = null;
        scheduleReconnect();
      };

      ws.onerror = () => {
        ws?.close();
      };
    } catch (err) {
      Logger.warn('WebSocket connection failed', { module: 'ApiClient' });
      scheduleReconnect();
    }
  });
}

export function disconnectWebSocket(): void {
  if (wsReconnectTimer) {
    clearTimeout(wsReconnectTimer);
    wsReconnectTimer = null;
  }
  if (ws) {
    try {
      ws.close();
    } catch {}
    ws = null;
  }
}

function scheduleReconnect(): void {
  if (wsReconnectTimer) return;
  wsReconnectTimer = setTimeout(() => {
    wsReconnectTimer = null;
    connectWebSocket();
  }, 5000);
}

export function onWsEvent(listener: (type: string, data: any) => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function isWsConnected(): boolean {
  return ws !== null && (ws as any).readyState === 1;
}
