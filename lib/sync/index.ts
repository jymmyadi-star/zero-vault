import { supabase, isSupabaseConfigured } from '../supabase';
import { useVaultStore } from '../store/vault-store';
import { pushChangeViaApi, drainBacklog } from './push';
import { pullChanges } from './pull';
import { startSyncScheduler, stopSyncScheduler } from './sync-scheduler';
import { connectWebSocket, disconnectWebSocket } from './api-client';
import { Logger } from '../logger';
import { kv } from '../storage';

const SYNC_ENABLED_KEY = 'zerovault_sync_enabled';

export function isSyncEnabled(): boolean {
  return kv.get(SYNC_ENABLED_KEY) === 'true';
}

export async function enableSync(): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) {
    Logger.warn('[Sync] Cannot enable — Supabase not configured', { module: 'SyncConfig' });
    return false;
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      const { error: anonErr } = await supabase.auth.signInAnonymously();
      if (anonErr) {
        Logger.warn('[Sync] Anonymous sign-in failed', {
          module: 'SyncConfig',
          error: anonErr.message,
        });
        return false;
      }
    }

    kv.set(SYNC_ENABLED_KEY, 'true');
    useVaultStore.getState().setSyncEnabled(true);

    connectWebSocket();
    startSyncScheduler();

    Logger.info('Cloud sync enabled', { module: 'SyncConfig' });
    return true;
  } catch (err: any) {
    Logger.error('[Sync] Failed to enable', err, { module: 'SyncConfig' });
    return false;
  }
}

export async function disableSync(): Promise<void> {
  stopSyncScheduler();
  disconnectWebSocket();

  kv.set(SYNC_ENABLED_KEY, 'false');
  useVaultStore.getState().setSyncEnabled(false);

  Logger.info('Cloud sync disabled', { module: 'SyncConfig' });
}

export function initSyncState(): void {
  const enabled = isSyncEnabled();
  if (enabled) {
    useVaultStore.getState().setSyncEnabled(true);
    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          connectWebSocket();
          startSyncScheduler();
        }
      });
    }
  }
}

export async function onVaultItemChanged(
  operation: 'INSERT' | 'UPDATE' | 'DELETE',
  entityId: string,
  plaintextPayload: Record<string, unknown>,
): Promise<void> {
  if (!isSyncEnabled()) return;

  try {
    await pushChangeViaApi(entityId, 'vaultItem', operation, plaintextPayload);
    scheduleBacklogDrain();
  } catch (err: any) {
    Logger.warn('[Sync] Failed to queue change for push', {
      module: 'SyncConfig',
      entityId,
      error: err.message,
    });
  }
}

let backlogTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleBacklogDrain(): void {
  if (backlogTimer) return;
  backlogTimer = setTimeout(() => {
    backlogTimer = null;
    drainBacklog().catch(() => {});
  }, 2000);
}

export { pullChanges };
