import { getV2Database } from '../db/database-v2';
import { syncBacklog } from '../db/schema-v2';
import { eq, asc, and } from 'drizzle-orm';
import { useVaultStore } from '../store/vault-store';
import { Logger } from '../logger';
import { readStoredHash, writeStoredHash, sealVerifiedHash, unsealVerifiedHash } from './verified-hash-v2';
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
  const cipherKeyCopy = cipherKey.copy();
  const lastVerifiedHash = await readStoredHash();
  const wrappedDek = wrapKey(dek, cipherKeyCopy);
  cipherKeyCopy.fill(0);
  const rawPayload = { envelope, wrappedDek: { iv: bytesToHex(wrappedDek.iv), ciphertext: bytesToHex(wrappedDek.ciphertext), tag: bytesToHex(wrappedDek.tag) } };
  const chainPayload = stringify(rawPayload);
  const signature = computeSyncSignature(chainPayload, lastVerifiedHash, signKeyCopy);
  signKeyCopy.fill(0);

  const serializedWrappedDek = {
    iv: bytesToHex(wrappedDek.iv),
    ciphertext: bytesToHex(wrappedDek.ciphertext),
    tag: bytesToHex(wrappedDek.tag),
  };

  dek.copyWithin(0, 0, dek.length); dek.fill(0);

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
        const signKeyCopy = signKey.copy();
        await writeStoredHash(sealVerifiedHash(signature, signKeyCopy));
        signKeyCopy.fill(0);
      }
    }
  } catch (err: any) {
    Logger.error('[Sync] Push failed — queuing to backlog', err, {
      module: 'SyncEngine',
      entityId,
    });
    await enqueueToBacklog(entityId, entityType, operation, plaintextPayload);
  }
}

export async function enqueueToBacklog(
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
    const db = getV2Database();

    const existing = await db.select({ sequence: syncBacklog.sequence }).from(syncBacklog);
    let maxSeq = existing.reduce((m, e) => Math.max(m, e.sequence), 0);

    if (existing.length >= MAX_BACKLOG_SIZE) {
      Logger.warn('[Sync] Backlog at capacity — compacting old entries', {
        module: 'SyncEngine', currentSize: existing.length, maxSize: MAX_BACKLOG_SIZE,
      });
      const all = await db.select().from(syncBacklog).orderBy(asc(syncBacklog.sequence));
      const latest = new Map<string, typeof all[0]>();
      for (const item of all) { latest.set(item.recordId, item); }
      let removed = 0;
      for (const item of all) {
        if (latest.get(item.recordId)?.id !== item.id) {
          await db.delete(syncBacklog).where(eq(syncBacklog.id, item.id));
          removed++;
        }
      }
      Logger.info('[Sync] Backlog compaction complete', { module: 'SyncEngine', removed, remaining: all.length - removed });
    }

    const keyEpochId = await getCurrentKeyEpoch();

    await db.insert(syncBacklog).values({
      id: `bl-${entityId}-${Date.now()}`, logId: `log-${entityId}`,
      sequence: maxSeq + 1, tableName: entityType, recordId: entityId,
      operation, payloadCiphertext, newRevision: '',
      keyEpochId, verified: false, createdAt: Date.now(),
    });
  } catch (err: any) {
    Logger.error('[Sync] Failed to enqueue to backlog', err, { module: 'SyncEngine' });
  } finally {
    signKeyCopy.fill(0);
  }
}

let isDraining = false;
let isDrainPending = false;

export async function drainBacklog(): Promise<void> {
  if (isDraining) { isDrainPending = true; return; }
  isDraining = true;

  try {
    await doDrainBacklog();
  } finally {
    isDraining = false;
    if (isDrainPending) {
      isDrainPending = false;
      drainBacklog();
    }
  }
}

async function doDrainBacklog(): Promise<void> {
  if (!getIsOnline()) return;

  const { syncEnabled, signKey } = useVaultStore.getState();
  if (!syncEnabled) return;
  const signKeyBuf = signKey?.copy();
  if (!signKeyBuf) return;

  const db = getV2Database();
  let backlogItems: any[];

  try {
    backlogItems = await db.select().from(syncBacklog).orderBy(asc(syncBacklog.sequence)).limit(20);
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
    const retryCount = item.retryCount ?? 0;
    if (retryCount >= MAX_RETRY_COUNT) {
      Logger.warn('[Sync] Backlog item exceeded max retries — discarding', {
        module: 'SyncEngine', recordId: item.recordId, retryCount,
      });
      await db.delete(syncBacklog).where(eq(syncBacklog.id, item.id));
      continue;
    }

    const payloadCiphertext = item.payloadCiphertext;
    if (!payloadCiphertext) continue;

    const storedHash = await readStoredHash();
    const currentHash = unsealVerifiedHash(storedHash, signKeyBuf);
    const rebuilt = rebuildChainSegment(payloadCiphertext, currentHash, signKeyBuf);
    if (!rebuilt) {
      Logger.warn('[Sync] Backlog item chain rebuild failed — flagging for retry', {
        module: 'SyncEngine', recordId: item.recordId,
      });
      await db.update(syncBacklog).set({ retryCount: retryCount + 1, errorReason: 'chain_rebuild_failed' }).where(eq(syncBacklog.id, item.id));
      continue;
    }

    try {
      const result = await apiClient.push([{
        entityId: item.recordId,
        entityType: 'vaultItem' as const,
        operation: item.operation as 'INSERT' | 'UPDATE' | 'DELETE',
        payloadCiphertext: rebuilt,
        newRevision: null,
        keyEpochId,
        hlc: item.hlc || new Date().toISOString(),
      }]);

      if (result.accepted > 0) {
        const chainData = JSON.parse(rebuilt);
        const signature = chainData?.chain?.signature;
        if (signature) {
          await writeStoredHash(sealVerifiedHash(signature, signKeyBuf));
        }
        await db.delete(syncBacklog).where(eq(syncBacklog.id, item.id));
      } else {
        await db.update(syncBacklog).set({ retryCount: (item.retryCount ?? 0) + 1, errorReason: 'Server rejected' }).where(eq(syncBacklog.id, item.id));
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
        try { 
          await pullChanges(); 
          // Refinement: Trigger a new drain cycle immediately so this item and others are pushed with the rebased hash.
          isDrainPending = true;
          break; // Exit current batch
        } catch (pullErr: any) {
          Logger.warn('[Sync] Pull after backlog conflict failed', { module: 'SyncEngine', error: pullErr.message });
          continue; // Move to next item or fail gracefully
        }
      }

      await db.update(syncBacklog).set({ retryCount: (item.retryCount ?? 0) + 1, errorReason: err.message }).where(eq(syncBacklog.id, item.id));
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
