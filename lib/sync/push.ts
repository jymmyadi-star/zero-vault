import { getDatabase } from '../db';
import {
  encryptPayload,
  computeSyncSignature,
  generateRandomKey,
  wrapKey,
  bytesToHex,
} from '../crypto/crypto-utils';
import { Logger } from '../logger';
import { readStoredHash, writeStoredHash, sealVerifiedHash, unsealVerifiedHash } from './verified-hash';
import { useVaultStore } from '../store/vault-store';
import { getIsOnline } from '../network-status';
import { apiClient } from './api-client';

async function buildSyncPayload(
  entityId: string,
  operation: 'INSERT' | 'UPDATE' | 'DELETE',
  plaintextPayload: Record<string, unknown>,
): Promise<string> {
  const { signKey: signKeyBuf } = useVaultStore.getState();
  if (!signKeyBuf) throw new Error('SYNC_KEY_MISSING');
  const signKey = signKeyBuf.copy();

  const dek = generateRandomKey();
  const payloadToEncrypt = { ...plaintextPayload, _meta: { entityType: 'vaultItem', operation } };
  const envelope = encryptPayload(payloadToEncrypt, dek, { entityId });
  const wrappedDek = wrapKey(dek, signKey);
  const serializedWrappedDek = {
    iv: bytesToHex(wrappedDek.iv),
    ciphertext: bytesToHex(wrappedDek.ciphertext),
    tag: bytesToHex(wrappedDek.tag),
  };

  const storedHash = await readStoredHash();
  const lastVerifiedHash = unsealVerifiedHash(storedHash, signKey);
  const chainPayload = JSON.stringify({ envelope, wrappedDek: serializedWrappedDek });
  const signature = computeSyncSignature(chainPayload, lastVerifiedHash, signKey);

  dek.fill(0);
  signKey.fill(0);

  return JSON.stringify({
    envelope,
    wrappedDek: serializedWrappedDek,
    chain: { prev_hash: lastVerifiedHash, signature },
  });
}

function rebuildChainSegment(
  payloadCiphertext: string,
  currentHash: string | null,
  signKey: Uint8Array,
): string | null {
  try {
    const parsed = JSON.parse(payloadCiphertext);
    const rawPayload = { envelope: parsed.envelope, wrappedDek: parsed.wrappedDek };
    const chainPayload = JSON.stringify(rawPayload);
    const signature = computeSyncSignature(chainPayload, currentHash, signKey);
    return JSON.stringify({
      ...parsed,
      chain: { prev_hash: currentHash, signature },
    });
  } catch {
    return null;
  }
}

export async function pushChangeViaApi(
  entityId: string,
  entityType: 'vaultItem',
  operation: 'INSERT' | 'UPDATE' | 'DELETE',
  plaintextPayload: Record<string, unknown>,
): Promise<void> {
  if (!getIsOnline()) {
    Logger.debug('[Sync] Push queued — offline', { module: 'SyncEngine' });
    await enqueueToBacklog(entityId, entityType, operation, plaintextPayload);
    return;
  }

  const { syncEnabled, signKey } = useVaultStore.getState();
  if (!syncEnabled || !signKey) return;

  try {
    const payloadCiphertext = await buildSyncPayload(entityId, operation, plaintextPayload);

    const result = await apiClient.push([{
      entityId,
      entityType,
      operation,
      payloadCiphertext,
      newRevision: null,
      keyEpochId: 0,
      hlc: new Date().toISOString(),
    }]);

    if (result.accepted > 0) {
      const chainData = JSON.parse(payloadCiphertext);
      const signature = chainData?.chain?.signature;
      if (signature && signKey) {
        const db = getDatabase();
        const signKeyCopy = signKey.copy();
        await db.write(async () => {
          await writeStoredHash(sealVerifiedHash(signature, signKeyCopy));
        });
        signKeyCopy.fill(0);
      }
    }
  } catch (err: any) {
    Logger.warn('[Sync] Push failed — queuing to local backlog', {
      module: 'SyncEngine',
      entityId,
      error: err.message,
    });
    await enqueueToBacklog(entityId, entityType, operation, plaintextPayload);
  }
}

async function enqueueToBacklog(
  entityId: string,
  entityType: string,
  operation: string,
  plaintextPayload: Record<string, unknown>,
): Promise<void> {
  try {
    const payloadCiphertext = await buildSyncPayload(entityId, operation as any, plaintextPayload);
    const db = getDatabase();

    await db.write(async () => {
      const existing = await db.get('sync_backlog').query().fetch();
      let maxSeq = 0;
      for (const row of existing) {
        const seq = (row as any).sequence || 0;
        if (seq > maxSeq) maxSeq = seq;
      }

      await db.get('sync_backlog').create((m: any) => {
        m.logId = `backlog-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        m.sequence = maxSeq + 1;
        m.tableName = entityType;
        m.recordId = entityId;
        m.operation = operation;
        m.payloadCiphertext = payloadCiphertext;
        m.plaintextPayload = JSON.stringify(plaintextPayload);
        m.newRevision = null;
        m.keyEpochId = 0;
        m.verified = false;
        m.prevHash = null;
        m.signature = null;
        m.hlc = new Date().toISOString();
        m.errorReason = null;
        m.retryCount = 0;
        m.createdAt = Date.now();
      });
    });

    Logger.info('[Sync] Queued to local backlog', { module: 'SyncEngine', entityId, operation });
  } catch (err: any) {
    Logger.error('[Sync] Failed to enqueue to backlog', err, { module: 'SyncEngine', entityId });
  }
}

const MAX_BACKLOG_SIZE = 500;

export async function drainBacklog(): Promise<void> {
  if (!getIsOnline()) return;

  const { syncEnabled, signKey } = useVaultStore.getState();
  if (!syncEnabled) return;
  const signKeyBuf = signKey?.copy();
  if (!signKeyBuf) return;

  const db = getDatabase();
  let backlogItems: any[];

  try {
    backlogItems = await db.get('sync_backlog').query().fetch();
  } catch {
    signKeyBuf.fill(0);
    return;
  }

  if (backlogItems.length === 0) {
    signKeyBuf.fill(0);
    return;
  }

  // Compact: if backlog exceeds limit, collapse entries for same recordId (keep latest)
  if (backlogItems.length > MAX_BACKLOG_SIZE) {
    const seen = new Map<string, any>();
    backlogItems.sort((a: any, b: any) => ((a as any).sequence || 0) - ((b as any).sequence || 0));
    for (const item of backlogItems) {
      seen.set((item.recordId || item._raw?.record_id), item);
    }
    backlogItems = [...seen.values()];
  }

  backlogItems.sort((a: any, b: any) => ((a as any).sequence || 0) - ((b as any).sequence || 0));

  const MAX_BATCH = 50;
  const batch = backlogItems.slice(0, MAX_BATCH);

  for (const item of batch) {
    const payloadCiphertext = item.payloadCiphertext || item._raw?.payload_ciphertext;
    const plaintextPayloadStr = item.plaintextPayload || item._raw?.plaintext_payload;
    if (!payloadCiphertext && !plaintextPayloadStr) continue;

    let rebuilt: string | null = null;
    const storedHash = await readStoredHash();
    const currentHash = unsealVerifiedHash(storedHash, signKeyBuf);

    if (plaintextPayloadStr) {
      try {
        const pt = JSON.parse(plaintextPayloadStr);
        rebuilt = await buildSyncPayload(item.recordId || item._raw?.record_id, (item.operation || item._raw?.operation || 'INSERT') as any, pt);
      } catch {
        rebuilt = rebuildChainSegment(payloadCiphertext, currentHash, signKeyBuf);
      }
    } else {
      rebuilt = rebuildChainSegment(payloadCiphertext, currentHash, signKeyBuf);
    }
    
    if (!rebuilt) continue;

    try {
      const result = await apiClient.push([{
        entityId: item.recordId || item._raw?.record_id,
        entityType: 'vaultItem' as const,
        operation: (item.operation || item._raw?.operation || 'INSERT') as 'INSERT' | 'UPDATE' | 'DELETE',
        payloadCiphertext: rebuilt,
        newRevision: null,
        keyEpochId: 0,
        hlc: item.hlc || item._raw?.hlc || new Date().toISOString(),
      }]);

      if (result.accepted > 0) {
        // Update verified hash from the newly accepted chain entry
        const chainData = JSON.parse(rebuilt);
        const signature = chainData?.chain?.signature;
        if (signature) {
          await db.write(async () => {
            await writeStoredHash(sealVerifiedHash(signature, signKeyBuf));
          });
        }

        // Remove from backlog
        await db.write(async () => {
          try {
            const record = await db.get('sync_backlog').find(item.id);
            await record.markAsDeleted();
          } catch {}
        });
      } else {
        // Server rejected — update retry count
        await db.write(async () => {
          try {
            const record = await db.get('sync_backlog').find(item.id);
            const currentRetry = (record as any).retryCount || (record as any)._raw?.retry_count || 0;
            await record.update((m: any) => {
              m.retryCount = currentRetry + 1;
              m.errorReason = 'Server rejected';
            });
          } catch {}
        });
      }
    } catch (err: any) {
      Logger.warn('[Sync] Backlog item drain failed', {
        module: 'SyncEngine',
        recordId: item.recordId,
        error: err.message,
      });

      await db.write(async () => {
        try {
          const record = await db.get('sync_backlog').find(item.id);
          const currentRetry = (record as any).retryCount || (record as any)._raw?.retry_count || 0;
          await record.update((m: any) => {
            m.retryCount = currentRetry + 1;
            m.errorReason = err.message;
          });
        } catch {}
      });
    }
  }

  signKeyBuf.fill(0);

  const remaining = backlogItems.length - batch.length;
  if (remaining > 0) {
    Logger.info('[Sync] Backlog drain in progress', {
      module: 'SyncEngine',
      processed: batch.length,
      remaining,
    });
  }
}

export const SyncPush = { pushChange: pushChangeViaApi };
