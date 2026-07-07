import { getDatabase } from '../db';
import { useVaultStore } from '../store/vault-store';
import { Logger } from '../logger';
import { verifyHashChain } from './hash-chain';
import { readStoredHash, writeStoredHash, sealVerifiedHash, unsealVerifiedHash } from './verified-hash';
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
    const db = getDatabase();
    let lastId = 0;
    let totalLogsProcessed = 0;
    let totalMerged = 0;

    try {
      const meta = await db.get('sync_meta').find('last_acked_seq');
      lastId = Number((meta as any).value) || 0;
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
              await db.write(async () => {
                await writeStoredHash(sealVerifiedHash(lastVerifiedHash!, signKeyCopy));
              });
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

      await db.write(async () => {
        try {
          const meta = await db.get('sync_meta').find('last_acked_seq');
          await meta.update((m: any) => { m.value = currentSinceId.toString(); });
        } catch {
          await db.get('sync_meta').create((m: any) => {
            m._raw.id = 'last_acked_seq';
            m.key = 'last_acked_seq';
            m.value = currentSinceId.toString();
          });
        }
      });

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

    const db = getDatabase();
    const operation: SyncOperation = (log.operation as SyncOperation) || 'INSERT';

    await db.write(async () => {
      const modelCollection = db.get(collection);

      try {
        const existing = await modelCollection.find(plaintext!.id as string);

        if (operation === 'DELETE') {
          await existing.markAsDeleted();
        } else {
          // Conflict detection: if local revision differs from incoming, record the conflict
          const localRevision = (existing as any).revision || (existing as any)._raw?.revision;
          const incomingRevision = log.new_revision || log.id.toString();
          const hasConflict = localRevision && incomingRevision && localRevision !== incomingRevision;

          if (hasConflict) {
            // Write to _conflicts table so the user can resolve it later
            try {
              await db.get('_conflicts').create((m: any) => {
                m._raw.id = `conflict-${log.entity_id}-${Date.now()}`;
                m.entityId = log.entity_id;
                m.entityType = log.entity_type;
                m.serverData = JSON.stringify(plaintext);
                m.serverRevision = incomingRevision;
                m.localData = JSON.stringify((existing as any)._raw || {});
                m.localRevision = localRevision;
                m.conflictReason = 'revision_mismatch';
                m.createdAt = Date.now();
              });
            } catch {
              // _conflicts write failure is non-fatal
            }
          } else {
            const updates: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(plaintext!)) {
              if (key !== 'id' && key !== '_meta') {
                updates[key] = value;
              }
            }

            if (updates.payload && typeof updates.payload === 'object') {
              const envelope = encryptPayload(updates.payload as Record<string, unknown>, cipherKey);
              updates.payloadCiphertext = JSON.stringify(envelope);
              delete updates.payload;
            }

            await existing.update((m: any) => {
              for (const [key, value] of Object.entries(updates)) {
                try { m[key] = value; } catch {}
              }
              m.updatedAt = Date.now();
            });
          }
        }
      } catch {
        if (operation !== 'DELETE') {
          const newEnvelope = encryptPayload(
            (plaintext!.payload as Record<string, unknown>) || plaintext!,
            cipherKey,
          );

          await modelCollection.create((m: any) => {
            m._raw.id = plaintext!.id;
            m.itemType = plaintext!.itemType || 'note';
            m.title = plaintext!.title || 'Untitled';
            m.payloadCiphertext = JSON.stringify(newEnvelope);
            m.folder = plaintext!.folder || null;
            m.icon = plaintext!.icon || null;
            m.urlHint = plaintext!.urlHint || null;
            m.favorite = plaintext!.favorite || false;
            m.lastUsedAt = plaintext!.lastUsedAt || null;
            m.createdAt = plaintext!.createdAt || Date.now();
            m.updatedAt = Date.now();
            m.revision = log.new_revision || log.id.toString();
            m.isPendingDelete = false;
          });
        }
      }
    });

    return true;
  } catch (err: any) {
    Logger.error('[Sync] mergeRemoteChange failed', err, { module: 'SyncEngine' });
    return false;
  }
}

export const SyncPull = { pullChanges };

async function cleanupOldConflicts(db: any): Promise<void> {
  const CONFLICT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
  const cutoff = Date.now() - CONFLICT_RETENTION_MS;
  try {
    const oldConflicts = await db.get('_conflicts').query().fetch();
    for (const c of oldConflicts) {
      const createdAt = c.createdAt || c._raw?.created_at || 0;
      if (createdAt < cutoff) {
        try { await c.markAsDeleted(); } catch {}
      }
    }
  } catch {}
}
