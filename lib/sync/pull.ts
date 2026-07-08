import { getV2Database, type V2Database } from '../db/database-v2';
import { vaultItems, syncMeta, conflicts } from '../db/schema-v2';
import { eq } from 'drizzle-orm';
import { useVaultStore } from '../store/vault-store';
import { Logger } from '../logger';
import { verifyHashChain } from './hash-chain';
import { readStoredHash, writeStoredHash, sealVerifiedHash, unsealVerifiedHash } from './verified-hash-v2';
import {
  unwrapKey,
  decryptPayload,
  encryptPayload,
  hexToBytes,
  type WrappedKey,
} from '../crypto/crypto-utils';
import { ENTITY_TO_COLLECTION } from './types';
import type { SyncOperation } from './types';
import { getIsOnline } from '../network-status';
import { apiClient } from './api-client';

let isPulling = false;
let isPullPending = false;

export async function pullChanges(): Promise<void> {
  if (isPulling) { isPullPending = true; return; }
  isPulling = true;

  try {
    await doPullChanges();
  } finally {
    isPulling = false;
    if (isPullPending) {
      isPullPending = false;
      pullChanges();
    }
  }
}

async function doPullChanges(): Promise<void> {
  const storeState = useVaultStore.getState();
  if (!storeState.syncEnabled || !storeState.signKey) {
    Logger.debug('[Sync] Pull skipped — sync not enabled', { module: 'SyncEngine' });
    return;
  }

  if (!getIsOnline()) {
    Logger.debug('[Sync] Pull skipped — offline', { module: 'SyncEngine' });
    return;
  }

  try {
    useVaultStore.getState().setSyncStatus('syncing');

    const PAGE_SIZE = 200;
    const db = getV2Database();
    let lastId = 0;
    let totalLogsProcessed = 0;
    let totalMerged = 0;

    try {
      const rows = await db.select().from(syncMeta).where(eq(syncMeta.key, 'last_acked_seq'));
      lastId = rows[0] ? Number(rows[0].value) || 0 : 0;
    } catch {
      lastId = 0;
    }

    const signKey = storeState.signKey!;

    const storedHash = await readStoredHash();
    const signKeyForHash = signKey.copy();
    let lastVerifiedHash = unsealVerifiedHash(storedHash, signKeyForHash);
    signKeyForHash.fill(0);
    let currentSinceId = lastId;

    while (true) {
      const result = await apiClient.pull(currentSinceId, PAGE_SIZE);

      if (!result.logs || result.logs.length === 0) break;

      totalLogsProcessed += result.logs.length;

      for (const log of result.logs) {
        let success = false;
        let retryCount = 0;

        while (!success && retryCount < 3) {
          try {
            const sKey1 = signKey.copy();
            await verifyHashChain(log, lastVerifiedHash, sKey1);
            sKey1.fill(0);
            const payloadData = JSON.parse(log.payload_ciphertext);
            
            const sKey2 = signKey.copy();
            const merged = await mergeRemoteChange(log, payloadData, sKey2);
            sKey2.fill(0);
            if (!merged) {
              throw new Error('Merge remote change failed locally');
            }
            
            totalMerged++;

            lastVerifiedHash = payloadData.chain?.signature ?? null;
            if (lastVerifiedHash) {
              const signKeyCopy = signKey.copy();
              await writeStoredHash(sealVerifiedHash(lastVerifiedHash!, signKeyCopy));
              signKeyCopy.fill(0);
            }

            currentSinceId = log.id;
            success = true;
          } catch (e) {
            retryCount++;
            const errorMessage = e instanceof Error ? e.message : String(e);

            if (errorMessage.includes('HASH_CHAIN_BROKEN')) {
              Logger.warn('Hash chain verification failed — skipping entry', {
                module: 'SyncEngine', logId: log.id, error: errorMessage,
              });
              currentSinceId = log.id;
              success = true;
            } else if (retryCount >= 3) {
              Logger.error('Failed to merge remote change after 3 retries', e, {
                module: 'SyncEngine', logId: log.id,
              });
              currentSinceId = log.id;
              success = true;
            } else {
              Logger.warn('Retrying log entry in pull', { module: 'SyncEngine', logId: log.id, retryCount });
            }
          }
        }
      }

      try {
        const existing = await db.select().from(syncMeta).where(eq(syncMeta.key, 'last_acked_seq'));
        if (existing.length > 0) {
          await db.update(syncMeta).set({ value: currentSinceId.toString() }).where(eq(syncMeta.key, 'last_acked_seq'));
        } else {
          await db.insert(syncMeta).values({ id: 'last_acked_seq', key: 'last_acked_seq', value: currentSinceId.toString() });
        }
      } catch {}

      if (!result.hasMore) break;
    }

    useVaultStore.getState().setSyncStatus('secured');
    if (totalLogsProcessed > 0) {
      useVaultStore.getState().setLastSyncAt(Date.now());
      Logger.info('Sync pull complete', {
        module: 'SyncEngine',
        event: 'pull_complete',
        logsProcessed: totalLogsProcessed,
        merged: totalMerged,
      });
    }

    await cleanupOldConflicts(db);
  } catch (err) {
    Logger.error('[Sync] Pull failed', err, { module: 'SyncEngine' });
    useVaultStore.getState().setSyncStatus('error');
  }
}

async function mergeRemoteChange(
  log: any,
  payloadData: Record<string, unknown>,
  _signKey: Uint8Array,
): Promise<boolean> {
  if (!log.entity_type || log.entity_type !== 'vaultItem') return false;

  const collection = ENTITY_TO_COLLECTION['vaultItem'];
  if (!collection) return false;

  const cipherKey = useVaultStore.getState().cipherKey?.copy();
  if (!cipherKey) return false;

  try {
    let plaintext: Record<string, unknown> | null = null;

    if (payloadData.envelope && payloadData.wrappedDek) {
      try {
        const wrappedDekData = typeof payloadData.wrappedDek === 'string' 
          ? JSON.parse(payloadData.wrappedDek) 
          : payloadData.wrappedDek;
          
        const wrapped: WrappedKey = {
          iv: hexToBytes(wrappedDekData.iv as string),
          ciphertext: hexToBytes(wrappedDekData.ciphertext as string),
          tag: hexToBytes(wrappedDekData.tag as string),
        };
        const dek = unwrapKey(wrapped, cipherKey);
        plaintext = decryptPayload(payloadData.envelope as any, dek);
        dek.fill(0);
      } catch (err: any) {
        Logger.error('Failed to decrypt remote payload', err, { module: 'SyncEngine', logId: log.id });
        return false;
      }
    } else {
      return false;
    }

    if (!plaintext || !plaintext.id) return false;

    const db = getV2Database();
    const operation: SyncOperation = (log.operation as SyncOperation) || 'INSERT';
    const id = plaintext!.id as string;

    // Query existing item
    const existingArray = await db.select().from(vaultItems).where(eq(vaultItems.id, id));
    const existing = existingArray[0];

    if (operation === 'DELETE') {
      await db.update(vaultItems).set({ isPendingDelete: true, updatedAt: Date.now() }).where(eq(vaultItems.id, id));
      return true;
    }

    // Conflict detection
    const localRevision = existing?.revision;
    const incomingRevision = log.new_revision || log.id.toString();
    const hasConflict = localRevision && incomingRevision && localRevision !== incomingRevision;

    if (existing && hasConflict) {
      await db.insert(conflicts).values({
        id: `conflict-${log.entity_id}-${Date.now()}`,
        entityId: log.entity_id,
        entityType: log.entity_type,
        serverData: JSON.stringify(plaintext),
        serverRevision: incomingRevision,
        localData: JSON.stringify(existing),
        localRevision: localRevision!,
        conflictReason: 'revision_mismatch',
        createdAt: Date.now(),
        isPendingDelete: false,
      });
      return true;
    }

    if (existing) {
      // UPDATE existing item
      const updates: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(plaintext!)) {
        if (key !== 'id' && key !== '_meta') updates[key] = value;
      }
      if (updates.payload && typeof updates.payload === 'object') {
        const envelope = encryptPayload(updates.payload as Record<string, unknown>, cipherKey);
        updates.payloadCiphertext = JSON.stringify(envelope);
        delete updates.payload;
      }
      await db.update(vaultItems).set({ ...updates as any, updatedAt: Date.now() }).where(eq(vaultItems.id, id));
    } else {
      // INSERT new item
      const newEnvelope = encryptPayload(
        (plaintext!.payload as Record<string, unknown>) || plaintext!,
        cipherKey,
      );
      await db.insert(vaultItems).values({
        id,
        itemType: (plaintext!.itemType as string) || 'note',
        title: (plaintext!.title as string) || 'Untitled',
        payloadCiphertext: JSON.stringify(newEnvelope),
        folder: (plaintext!.folder as string) || null,
        icon: (plaintext!.icon as string) || null,
        urlHint: (plaintext!.urlHint as string) || null,
        favorite: (plaintext!.favorite as boolean) || false,
        lastUsedAt: (plaintext!.lastUsedAt as number) || null,
        createdAt: (plaintext!.createdAt as number) || Date.now(),
        updatedAt: Date.now(),
        revision: log.new_revision || log.id.toString(),
        isPendingDelete: false,
      });
    }

    return true;
  } catch (err: any) {
    Logger.error('[Sync] mergeRemoteChange failed', err, { module: 'SyncEngine' });
    return false;
  }
}

export const SyncPull = { pullChanges };

async function cleanupOldConflicts(db: V2Database): Promise<void> {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  try {
    const oldConflicts = await db.select().from(conflicts).where(eq(conflicts.isPendingDelete, false));
    for (const c of oldConflicts) {
      if (c.createdAt < cutoff) {
        await db.update(conflicts).set({ isPendingDelete: true }).where(eq(conflicts.id, c.id));
      }
    }
  } catch {}
}
