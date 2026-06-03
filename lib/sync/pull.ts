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

export async function pullChanges(): Promise<void> {
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

    let lastVerifiedHash: string | null = null;
    let currentSinceId = lastId;

    while (true) {
      const result = await apiClient.pull(currentSinceId, PAGE_SIZE);

      if (!result.logs || result.logs.length === 0) break;

      totalLogsProcessed += result.logs.length;

      for (const log of result.logs) {
        try {
          await verifyHashChain(log, lastVerifiedHash, signKey.copy());
          const payloadData = JSON.parse(log.payload_ciphertext);
          lastVerifiedHash = payloadData.chain?.signature ?? null;
          const merged = await mergeRemoteChange(log, payloadData, signKey.copy());
          if (merged) totalMerged++;

          if (lastVerifiedHash) {
            const signKeyCopy = signKey.copy();
            await db.write(async () => {
              await writeStoredHash(sealVerifiedHash(lastVerifiedHash!, signKeyCopy));
            });
            signKeyCopy.fill(0);
          }

          currentSinceId = log.id;
        } catch (e) {
          Logger.warn('Hash chain verification failed — stopping pull', {
            module: 'SyncEngine',
            logId: log.id,
            error: e instanceof Error ? e.message : String(e),
          });
          useVaultStore.getState().setSyncStatus('error');
          return;
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
  } catch (err) {
    Logger.error('[Sync] Pull failed', err, { module: 'SyncEngine' });
    useVaultStore.getState().setSyncStatus('error');
  }
}

async function mergeRemoteChange(
  log: any,
  payloadData: Record<string, unknown>,
  signKey: Uint8Array,
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
        const wrappedDekData = payloadData.wrappedDek as Record<string, unknown>;
        const wrapped: WrappedKey = {
          iv: hexToBytes(wrappedDekData.iv as string),
          ciphertext: hexToBytes(wrappedDekData.ciphertext as string),
          tag: hexToBytes(wrappedDekData.tag as string),
        };
        const dek = unwrapKey(wrapped, signKey);
        plaintext = decryptPayload(payloadData.envelope as any, dek);
        dek.fill(0);
      } catch {
        return false;
      }
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
              // _conflicts write failure is non-fatal — proceed with server-wins merge
            }
          }

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
  } catch {
    return false;
  }
}

export const SyncPull = { pullChanges };
