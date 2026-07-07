import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const vaultItems = sqliteTable('vault_items', {
  id: text('id').primaryKey(),
  itemType: text('item_type').notNull(),
  title: text('title').notNull(),
  folder: text('folder'),
  payloadCiphertext: text('payload_ciphertext').notNull(),
  favorite: integer('favorite', { mode: 'boolean' }).notNull().default(false),
  icon: text('icon'),
  urlHint: text('url_hint'),
  lastUsedAt: integer('last_used_at', { mode: 'number' }),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
  revision: text('revision'),
  isPendingDelete: integer('is_pending_delete', { mode: 'boolean' }).notNull().default(false),
}, (t) => ({
  itemTypeIdx: index('idx_v2_vault_items_item_type').on(t.itemType),
  folderIdx: index('idx_v2_vault_items_folder').on(t.folder),
  updatedAtIdx: index('idx_v2_vault_items_updated_at').on(t.updatedAt),
  revisionIdx: index('idx_v2_vault_items_revision').on(t.revision),
  pendingDeleteIdx: index('idx_v2_vault_items_pending_delete').on(t.isPendingDelete),
}));

export const syncBacklog = sqliteTable('sync_backlog', {
  id: text('id').primaryKey(),
  logId: text('log_id').notNull(),
  sequence: integer('sequence', { mode: 'number' }).notNull(),
  tableName: text('table_name').notNull(),
  recordId: text('record_id').notNull(),
  operation: text('operation').notNull(),
  payloadCiphertext: text('payload_ciphertext').notNull(),
  newRevision: text('new_revision'),
  keyEpochId: integer('key_epoch_id', { mode: 'number' }).notNull().default(0),
  verified: integer('verified', { mode: 'boolean' }).notNull().default(false),
  prevHash: text('prev_hash'),
  signature: text('signature'),
  hlc: text('hlc'),
  errorReason: text('error_reason'),
  retryCount: integer('retry_count', { mode: 'number' }).notNull().default(0),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
}, (t) => ({
  logIdIdx: index('idx_v2_backlog_log_id').on(t.logId),
  sequenceIdx: index('idx_v2_backlog_sequence').on(t.sequence),
  recordIdIdx: index('idx_v2_backlog_record_id').on(t.recordId),
  verifiedIdx: index('idx_v2_backlog_verified').on(t.verified),
}));

export const syncMeta = sqliteTable('sync_meta', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
}, (t) => ({
  keyIdx: index('idx_v2_meta_key').on(t.key),
}));

export const conflicts = sqliteTable('_conflicts', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull(),
  entityType: text('entity_type').notNull(),
  serverData: text('server_data').notNull(),
  serverRevision: text('server_revision').notNull(),
  localData: text('local_data'),
  localRevision: text('local_revision'),
  conflictReason: text('conflict_reason'),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  isPendingDelete: integer('is_pending_delete', { mode: 'boolean' }).notNull().default(false),
}, (t) => ({
  entityTypeIdx: index('idx_v2_conflicts_entity_type').on(t.entityType),
  createdAtIdx: index('idx_v2_conflicts_created_at').on(t.createdAt),
  pendingDeleteIdx: index('idx_v2_conflicts_pending_delete').on(t.isPendingDelete),
}));
