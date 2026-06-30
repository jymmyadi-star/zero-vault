import { getDatabase } from '../db';
import { useVaultStore } from '../store/vault-store';
import { Logger } from '../logger';
import { readStoredHash, writeStoredHash, sealVerifiedHash, unsealVerifiedHash } from './verified-hash';
import { verifyHashChain } from './hash-chain';
import {
  computeSyncSignature, wrapKey, encryptPayload, deriveSignKey,
  randomBytes, bytesToHex, hexToBytes, generateRandomKey,
  type WrappedKey,
} from '../crypto/crypto-utils';
import { getIsOnline } from '../network-status';
import { apiClient } from './api-client';
import { pullChanges } from './pull';
import { default as stringify } from 'fast-json-stable-stringify';

const MAX_BACKLOG_SIZE = 5000;
const MAX_RETRY_COUNT = 10;

async function getCurrentKeyEpoch(): Promise<number> {
  try {
    const { default: SecureStore } = await import('expo-secure-store');
    const epochStr = await SecureStore.getItemAsync('zerovault_key_epoch');
    return epochStr ? parseInt(epochStr, 10) : 0;
  } catch {
    return 0;
  }
}

async function buildSyncPayload(
  entityId: string,
  operation: 'INSERT' | 'UPDATE' | 'DELETE',
  plaintextPayload: Record<string, unknown>,
): Promise<string> {
  const { signKey, cipherKey } = useVaultStore.getState();
  if (!signKey || !cipherKey) throw new Error('Vault not unlocked');

  const dek = generateRandomKey();
  const envelope = encryptPayload(plaintextPayload, dek, { entityId, operation });

  const signKeyCopy = signKey.copy();
  const lastVerifiedHash = await readStoredHash();
  const rawPayload = { envelope, wrappedDek: { iv: envelope.iv, ciphertext: envelope.ct, tag: envelope.tag } };
  const chainPayload = stringify(rawPayload);
  const signature = computeSyncSignature(chainPayload, lastVerifiedHash, signKeyCopy);
  signKeyCopy.fill(0);

  const serializedWrappedDek = JSON.stringify({
    iv: bytesToHex(dek), ciphertext: '', tag: '',
  });

  dek.fill(0);

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
    const chainPayload = stringify(rawPayload);
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
    const keyEpochId = await getCurrentKeyEpoch();

    const result = await apiClient.push([{
      entityId,
      entityType,
      operation,
      payloadCiphertext,
      newRevision: null,
      keyEpochId,
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
    Logger.error('[Sync] Push failed — queuing to backlog', {
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
  const { signKey } = useVaultStore.getState();
  if (!signKey) return;

  const signKeyCopy = signKey.copy();
  try {
    const payloadCiphertext = await buildSyncPayload(entityId, operation as any, plaintextPayload);
    const db = getDatabase();

    const existing = await db.get('sync_backlog').query().fetch();
    let maxSeq = 0;
    for (const item of existing) {
      const seq = (item as any).sequence || (item as any)._raw?.sequence || 0;
      if (seq > maxSeq) maxSeq = seq;
    }

    if (existing.length >= MAX_BACKLOG_SIZE) {
      Logger.warn('[Sync] Backlog at capacity — compacting old entries', {
        module: 'SyncEngine',
        currentSize: existing.length,
        maxSize: MAX_BACKLOG_SIZE,
      });

      const oldestByRecord = new Map<string, any[]>();
      for (const item of existing) {
        const rid = (item as any).recordId || (item as any)._raw?.record_id || '';
        if (!oldestByRecord.has(rid)) oldestByRecord.set(rid, []);
        oldestByRecord.get(rid)!.push(item);
      }

      let removed = 0;
      for (const [rid, items] of oldestByRecord) {
        if (items.length <= 1) continue;
        items.sort((a: any, b: any) => ((a as any).sequence || 0) - ((b as any).sequence || 0));
        for (let i = 0; i < items.length - 1; i++) {
          try {
            await db.write(async () => {
              const record = await db.get('sync_backlog').find(items[i].id);
              await record.markAsDeleted();
            });
            removed++;
          } catch {}
        }
        if (existing.length - removed < MAX_BACKLOG_SIZE * 0.8) break;
      }

      Logger.info('[Sync] Backlog compaction complete', {
        module: 'SyncEngine',
        removed,
        remaining: existing.length - removed,
      });
    }

    const keyEpochId = await getCurrentKeyEpoch();

    await db.write(async () => {
      await db.get('sync_backlog').create((m: any) => {
        m._raw.id = `bl-${entityId}-${Date.now()}`;
        m.logId = `log-${entityId}`;
        m.sequence = maxSeq + 1;
        m.tableName = entityType;
        m.recordId = entityId;
        m.operation = operation;
        m.payloadCiphertext = payloadCiphertext;
        m.newRevision = '';
        m.keyEpochId = keyEpochId;
        m.verified = false;
        m.createdAt = Date.now();
      });
    });
  } catch (err: any) {
    Logger.error('[Sync] Failed to enqueue to backlog', { module: 'SyncEngine', error: err.message });
  } finally {
    signKeyCopy.fill(0);
  }
}

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

  backlogItems.sort((a: any, b: any) => ((a as any).sequence || 0) - ((b as any).sequence || 0));

  const MAX_BATCH = 50;
  const batch = backlogItems.slice(0, MAX_BATCH);

  const keyEpochId = await getCurrentKeyEpoch();

  for (const item of batch) {
    const retryCount = (item as any).retryCount || (item as any)._raw?.retry_count || 0;
    if (retryCount >= MAX_RETRY_COUNT) {
      Logger.warn('[Sync] Backlog item exceeded max retries — discarding', {
        module: 'SyncEngine',
        recordId: item.recordId || item._raw?.record_id,
        retryCount,
      });
      await db.write(async () => {
        try {
          const record = await db.get('sync_backlog').find(item.id);
          await record.markAsDeleted();
        } catch {}
      });
      continue;
    }

    const payloadCiphertext = item.payloadCiphertext || item._raw?.payload_ciphertext;
    if (!payloadCiphertext) continue;

    const storedHash = await readStoredHash();
    const currentHash = unsealVerifiedHash(storedHash, signKeyBuf);
    const rebuilt = rebuildChainSegment(payloadCiphertext, currentHash, signKeyBuf);
    if (!rebuilt) {
      Logger.warn('[Sync] Backlog item chain rebuild failed — flagging for retry', {
        module: 'SyncEngine', recordId: item.recordId,
      });
      await db.write(async () => {
        try {
          const record = await db.get('sync_backlog').find(item.id);
          const currentRetry = (record as any).retryCount || (record as any)._raw?.retry_count || 0;
          await record.update((m: any) => {
            m.retryCount = currentRetry + 1;
            m.errorReason = 'chain_rebuild_failed';
          });
        } catch {}
      });
      continue;
    }

    try {
      const result = await apiClient.push([{
        entityId: item.recordId || item._raw?.record_id,
        entityType: 'vaultItem' as const,
        operation: (item.operation || item._raw?.operation || 'INSERT') as 'INSERT' | 'UPDATE' | 'DELETE',
        payloadCiphertext: rebuilt,
        newRevision: null,
        keyEpochId,
        hlc: item.hlc || item._raw?.hlc || new Date().toISOString(),
      }]);

      if (result.accepted > 0) {
        const chainData = JSON.parse(rebuilt);
        const signature = chainData?.chain?.signature;
        if (signature) {
          await db.write(async () => {
            await writeStoredHash(sealVerifiedHash(signature, signKeyBuf));
          });
        }

        await db.write(async () => {
          try {
            const record = await db.get('sync_backlog').find(item.id);
            await record.markAsDeleted();
          } catch {}
        });
      } else {
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

      if (err.message?.includes('HASH_CHAIN_CONFLICT')) {
        Logger.info('[Sync] Hash chain conflict during backlog drain — pulling to rebase', {
          module: 'SyncEngine', recordId: item.recordId,
        });
        try { await pullChanges(); } catch (pullErr: any) {
          Logger.warn('[Sync] Pull after backlog conflict failed', { module: 'SyncEngine', error: pullErr.message });
        }
        continue;
      }

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

export const SyncPush = { pushChangeViaApi, drainBacklog };
