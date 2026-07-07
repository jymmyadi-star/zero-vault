import { supabase, isSupabaseConfigured } from '../supabase';
import { useVaultStore } from '../store/vault-store';
import { pushChangeViaApi, drainBacklog } from './push';
import { pullChanges } from './pull';
import { startSyncScheduler, stopSyncScheduler } from './sync-scheduler';
import { connectWebSocket, disconnectWebSocket } from './api-client';
import { Logger } from '../logger';
import { kv } from '../storage';
import { consentManager } from '../consent-manager';
import { deriveDeviceCredentials } from '../crypto/crypto-utils';
import * as SecureStore from 'expo-secure-store';
import { pushVaultSeed } from './identity';

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
      const pairingId = await SecureStore.getItemAsync('zerovault_pairing_id_v3');
      if (!pairingId) {
        Logger.warn('[Sync] No pairing ID — cannot enable deterministic sync', { module: 'SyncConfig' });
        return false;
      }
      const creds = deriveDeviceCredentials(pairingId);
      // Try sign-in first (existing user), fallback to sign-up
      let { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: creds.email,
        password: creds.password,
      });
      if (signInError) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: creds.email,
          password: creds.password,
        });
        if (signUpError || !signUpData.user) {
          Logger.warn(`[Sync] Deterministic sign-in failed: ${signUpError?.message || signInError?.message}`, {
            module: 'SyncConfig',
          });
          return false;
        }
      }
    }

    const hasConsent = await consentManager.has('cloud_sync');
    if (!hasConsent) {
      Logger.warn('[Sync] Consent required — user has not granted cloud_sync consent', { module: 'SyncConfig' });
      return false;
    }

    kv.set(SYNC_ENABLED_KEY, 'true');
    useVaultStore.getState().setSyncEnabled(true);

    connectWebSocket();

    // Push the seed to the server so the extension can download it
    await pushVaultSeed();

    // ENQUEUE ALL EXISTING ITEMS FOR INITIAL SYNC
    try {
      const { getDatabase } = require('../db');
      const { decryptVaultItem } = require('../services/vault-service');
      const { enqueueToBacklog } = require('./push');
      
      const db = getDatabase();
      const items = await db.get('vault_items').query().fetch();
      for (const item of items) {
        if (item.isPendingDelete || item._raw?.is_pending_delete) continue;
        const raw = item._raw || {};
        const decrypted = await decryptVaultItem({
           id: item.id,
           itemType: item.itemType ?? raw.item_type,
           title: item.title ?? raw.title,
           folder: item.folder ?? raw.folder ?? null,
           payloadCiphertext: item.payloadCiphertext ?? raw.payload_ciphertext,
           favorite: item.favorite ?? raw.favorite ?? false,
           icon: item.icon ?? raw.icon ?? null,
           urlHint: item.urlHint ?? raw.url_hint ?? null,
           lastUsedAt: item.lastUsedAt ?? raw.last_used_at ?? null,
           createdAt: item.createdAt ?? raw.created_at ?? 0,
           updatedAt: item.updatedAt ?? raw.updated_at ?? 0,
        });
        
        if (decrypted) {
           await enqueueToBacklog(item.id, 'vaultItem', 'INSERT', {
             id: decrypted.id,
             itemType: decrypted.itemType,
             title: decrypted.title,
             payload: decrypted.payload,
             folder: decrypted.folder,
             icon: decrypted.icon,
             urlHint: decrypted.urlHint,
             favorite: decrypted.favorite,
             lastUsedAt: decrypted.lastUsedAt,
             createdAt: decrypted.createdAt,
           });
        }
      }
    } catch (e) {
      Logger.warn('[Sync] Failed to enqueue initial items', { error: e });
    }

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
