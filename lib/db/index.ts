import { Database, type Database as DatabaseType } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { Logger } from '../logger';
import schema from './schema';
import migrations from './migrations';
import { VaultItem, SyncBacklog, SyncMeta, Conflict } from './models';
import * as FileSystem from 'expo-file-system/legacy';

let database!: DatabaseType;

const DB_NAME = 'zerovault_secure_db';

async function deleteCorruptedDatabase(): Promise<void> {
  try {
    const baseDir = (FileSystem as any).documentDirectory || FileSystem.cacheDirectory || '';
    const sqliteDir = `${baseDir}SQLite/`;
    const dbPath = `${sqliteDir}${DB_NAME}`;
    const files = [dbPath, `${dbPath}.db`, `${dbPath}-wal`, `${dbPath}-shm`];
    const randomBlock = Array.from(crypto.getRandomValues(new Uint8Array(4096)))
      .map(b => String.fromCharCode(b)).join('');

    for (const path of files) {
      try {
        const info = await FileSystem.getInfoAsync(path);
        if (info.exists) {
          // Overwrite with random data before deletion to prevent forensic recovery
          try {
            await FileSystem.writeAsStringAsync(path, randomBlock, { encoding: FileSystem.EncodingType.Base64 });
          } catch {}
          await FileSystem.deleteAsync(path, { idempotent: true });
          Logger.info('[Database] Securely deleted corrupted file', { module: 'Database', path });
        }
      } catch {}
    }
  } catch {}
}

async function applySqlCipherEncryption(adapter: SQLiteAdapter, encryptionKeyHex: string): Promise<void> {
  if (!/^[0-9a-fA-F]+$/.test(encryptionKeyHex)) {
    throw new Error('[Database] Invalid encryption key format');
  }
  await (adapter as unknown as { unsafeExecute(options: { sqls: [string, unknown[]][] }): Promise<void> }).unsafeExecute({
    sqls: [
      [`PRAGMA key = "x'${encryptionKeyHex}'"`, []],
      [`PRAGMA rekey = "x'${encryptionKeyHex}'"`, []],
    ],
  });
  Logger.info('[Database] SQLCipher encryption applied', { module: 'Database' });
}

function createAdapter(): SQLiteAdapter {
  return new SQLiteAdapter({
    schema,
    migrations,
    dbName: DB_NAME,
    jsi: false,
    onSetUpError: (error) => {
      Logger.error('[Database] Setup failed', error, { module: 'Database' });
    },
  });
}

function createDatabase(adapter: SQLiteAdapter): DatabaseType {
  return new Database({
    adapter,
    modelClasses: [VaultItem, SyncBacklog, SyncMeta, Conflict],
  });
}

export async function initializeDatabase(vaultKeyHex: string): Promise<DatabaseType> {
  if (database) return database;

  let corrupted = false;

  const adapter = createAdapter();
  database = createDatabase(adapter);

  try {
    await adapter.initializingPromise;
  } catch (err: any) {
    if (err?.message?.includes('corrupt') || err?.message?.includes('CORRUPT') || err?.message?.includes('malformed')) {
      corrupted = true;
      Logger.warn('[Database] Corrupted database detected — recreating', { module: 'Database', error: err.message });
    } else {
      throw err;
    }
  }

  let activeAdapter = adapter;

  if (corrupted) {
    database = null!;
    await deleteCorruptedDatabase();

    activeAdapter = createAdapter();
    database = createDatabase(activeAdapter);
    await activeAdapter.initializingPromise;
  }

  try {
    await applySqlCipherEncryption(activeAdapter, vaultKeyHex);
  } catch (err: any) {
    Logger.error('[Database] FATAL: Failed to apply SQLCipher encryption', err, { module: 'Database' });
    throw new Error(`CRITICAL SECURITY FAILURE: Could not encrypt local database. Details: ${err.message}`);
  }

  await ensureIndexes(activeAdapter);

  Logger.info('[Database] Initialized successfully', { module: 'Database' });
  return database;
}

async function ensureIndexes(adapter: SQLiteAdapter): Promise<void> {
  const indexes: [string, unknown[]][] = [
    ['CREATE INDEX IF NOT EXISTS idx_vault_items_is_pending_delete ON vault_items (is_pending_delete)', []],
    ['CREATE INDEX IF NOT EXISTS idx_vault_items_updated_at ON vault_items (updated_at)', []],
    ['CREATE INDEX IF NOT EXISTS idx_vault_items_revision ON vault_items (revision)', []],
    ['CREATE INDEX IF NOT EXISTS idx_vault_items_folder ON vault_items (folder)', []],
    ['CREATE INDEX IF NOT EXISTS idx_sync_backlog_record_id ON sync_backlog (record_id)', []],
    ['CREATE INDEX IF NOT EXISTS idx_sync_backlog_verified ON sync_backlog (verified)', []],
    ['CREATE INDEX IF NOT EXISTS idx_conflicts_entity_type ON _conflicts (entity_type)', []],
    ['CREATE INDEX IF NOT EXISTS idx_conflicts_created_at ON _conflicts (created_at)', []],
    ['CREATE INDEX IF NOT EXISTS idx_conflicts_is_pending_delete ON _conflicts (is_pending_delete)', []],
  ];
  try {
    await (adapter as unknown as { unsafeExecute(options: { sqls: [string, unknown[]][] }): Promise<void> }).unsafeExecute({ sqls: indexes });
    Logger.info('[Database] Indexes ensured', { module: 'Database' });
  } catch (e) {
    Logger.warn('[Database] Failed to ensure indexes — continuing', { module: 'Database', error: e });
  }
}

export function getDatabase(): DatabaseType {
  if (!database) {
    throw new Error('[Database] getDatabase() called before initializeDatabase()');
  }
  return database;
}

export async function purgeDatabase(): Promise<void> {
  if (database) {
    try {
      await database.write(async () => {
        await database.unsafeResetDatabase();
      });
    } catch (e: any) {
      Logger.warn('[Database] unsafeResetDatabase failed', { error: e.message });
    }
  }
  await deleteCorruptedDatabase();
  database = null!;
}

export { database };
