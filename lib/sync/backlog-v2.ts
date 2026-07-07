import { eq, asc } from 'drizzle-orm';
import { getV2Database } from '../db/database-provider-v2';
import { syncBacklog } from '../db/schema-v2';
import { Logger } from '../logger';

const MAX_BACKLOG_SIZE = 5000;

async function getCurrentKeyEpoch(): Promise<number> {
  try {
    const { SecureStore } = require('expo-secure-store');
    const epoch = await SecureStore.getItemAsync('zerovault_key_epoch_v3');
    return epoch ? parseInt(epoch, 10) : 0;
  } catch { return 0; }
}

export async function enqueueToBacklogV2(
  entityId: string,
  entityType: string,
  operation: string,
  payloadCiphertext: string,
): Promise<void> {
  try {
    const db = getV2Database();

    const existing = await db.select({ sequence: syncBacklog.sequence }).from(syncBacklog);
    const maxSeq = existing.reduce((m, e) => Math.max(m, e.sequence), 0);

    const count = existing.length;
    if (count >= MAX_BACKLOG_SIZE) {
      Logger.warn('[Sync V2] Backlog at capacity — compacting', { module: 'SyncEngineV2', count });
      const all = await db.select().from(syncBacklog).orderBy(asc(syncBacklog.sequence));
      const latest = new Map<string, typeof all[0]>();
      for (const item of all) {
        latest.set(item.recordId, item);
      }
      const toDelete = all.filter((item) => latest.get(item.recordId)?.id !== item.id);
      for (const item of toDelete) {
        await db.delete(syncBacklog).where(eq(syncBacklog.id, item.id));
      }
      Logger.info('[Sync V2] Backlog compaction complete', { module: 'SyncEngineV2', removed: toDelete.length });
    }

    const keyEpochId = await getCurrentKeyEpoch();

    await db.insert(syncBacklog).values({
      id: `bl-${entityId}-${Date.now()}`,
      logId: `log-${entityId}`,
      sequence: maxSeq + 1,
      tableName: entityType,
      recordId: entityId,
      operation,
      payloadCiphertext,
      newRevision: '',
      keyEpochId,
      verified: false,
      createdAt: Date.now(),
    });
  } catch (err: any) {
    Logger.error('[Sync V2] Failed to enqueue to backlog', { module: 'SyncEngineV2', error: err.message });
  }
}

export async function getBacklogCountV2(): Promise<number> {
  try {
    const db = getV2Database();
    const rows = await db.select({ id: syncBacklog.id }).from(syncBacklog);
    return rows.length;
  } catch { return 0; }
}
