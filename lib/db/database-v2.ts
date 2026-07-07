import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import * as schema from './schema-v2';
import { Logger } from '../logger';

export type V2Database = ExpoSQLiteDatabase<typeof schema>;

let db: V2Database | null = null;
const DB_NAME = 'zerovault_v2.db';

export async function initializeV2Database(vaultKeyHex: string): Promise<V2Database> {
  if (db) return db;

  if (!/^[0-9a-fA-F]+$/.test(vaultKeyHex)) {
    throw new Error('[Database V2] Invalid encryption key format');
  }

  const sqlite = openDatabaseSync(DB_NAME);

  // Apply SQLCipher encryption
  await sqlite.execAsync(`PRAGMA key = "x'${vaultKeyHex}'"`);
  await sqlite.execAsync(`PRAGMA cipher_memory_security = ON`);

  db = drizzle(sqlite, { schema });
  await ensureV2Tables();
  return db;
}

async function ensureV2Tables(): Promise<void> {
  if (!db) return;
  try {
    await db.run(sql.raw(`
      CREATE TABLE IF NOT EXISTS vault_items (
        id TEXT PRIMARY KEY,
        item_type TEXT NOT NULL,
        title TEXT NOT NULL,
        folder TEXT,
        payload_ciphertext TEXT NOT NULL,
        favorite INTEGER NOT NULL DEFAULT 0,
        icon TEXT,
        url_hint TEXT,
        last_used_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        revision TEXT,
        is_pending_delete INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS sync_backlog (
        id TEXT PRIMARY KEY,
        log_id TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        table_name TEXT NOT NULL,
        record_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        payload_ciphertext TEXT NOT NULL,
        new_revision TEXT,
        key_epoch_id INTEGER NOT NULL DEFAULT 0,
        verified INTEGER NOT NULL DEFAULT 0,
        prev_hash TEXT,
        signature TEXT,
        hlc TEXT,
        error_reason TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sync_meta (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS _conflicts (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        server_data TEXT NOT NULL,
        server_revision TEXT NOT NULL,
        local_data TEXT,
        local_revision TEXT,
        conflict_reason TEXT,
        created_at INTEGER NOT NULL,
        is_pending_delete INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_v2_vault_items_item_type ON vault_items (item_type);
      CREATE INDEX IF NOT EXISTS idx_v2_vault_items_updated_at ON vault_items (updated_at);
      CREATE INDEX IF NOT EXISTS idx_v2_vault_items_pending_delete ON vault_items (is_pending_delete);
      CREATE INDEX IF NOT EXISTS idx_v2_backlog_sequence ON sync_backlog (sequence);
      CREATE INDEX IF NOT EXISTS idx_v2_backlog_record_id ON sync_backlog (record_id);
      CREATE INDEX IF NOT EXISTS idx_v2_backlog_verified ON sync_backlog (verified);
      CREATE INDEX IF NOT EXISTS idx_v2_meta_key ON sync_meta (key);
    `));
    Logger.info('[Database V2] Tables and indexes ensured', { module: 'DatabaseV2' });
  } catch (e: any) {
    Logger.error('[Database V2] Failed to ensure tables', e, { module: 'DatabaseV2' });
    throw e;
  }
}

import { sql } from 'drizzle-orm';

export function getV2Database(): V2Database {
  if (!db) throw new Error('[Database V2] getV2Database() called before initializeV2Database()');
  return db;
}

export async function purgeV2Database(): Promise<void> {
  if (db) {
    const sqlite = openDatabaseSync(DB_NAME);
    await sqlite.execAsync('DELETE FROM vault_items');
    await sqlite.execAsync('DELETE FROM sync_backlog');
    await sqlite.execAsync('DELETE FROM sync_meta');
    await sqlite.execAsync('DELETE FROM _conflicts');
  }
  db = null;
}
