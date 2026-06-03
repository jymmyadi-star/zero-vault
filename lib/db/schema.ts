import { appSchema, tableSchema } from '@nozbe/watermelondb';

export default appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'vault_items',
      columns: [
        { name: 'item_type', type: 'string', isIndexed: true },
        { name: 'title', type: 'string' },
        { name: 'folder', type: 'string', isOptional: true },
        { name: 'payload_ciphertext', type: 'string' },
        { name: 'favorite', type: 'boolean' },
        { name: 'icon', type: 'string', isOptional: true },
        { name: 'url_hint', type: 'string', isOptional: true },
        { name: 'last_used_at', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'revision', type: 'string', isOptional: true },
        { name: 'is_pending_delete', type: 'boolean' },
      ],
    }),
    tableSchema({
      name: 'sync_backlog',
      columns: [
        { name: 'log_id', type: 'string', isIndexed: true },
        { name: 'sequence', type: 'number', isIndexed: true },
        { name: 'table_name', type: 'string' },
        { name: 'record_id', type: 'string' },
        { name: 'operation', type: 'string' },
        { name: 'payload_ciphertext', type: 'string' },
        { name: 'plaintext_payload', type: 'string', isOptional: true },
        { name: 'new_revision', type: 'string' },
        { name: 'key_epoch_id', type: 'number' },
        { name: 'verified', type: 'boolean' },
        { name: 'prev_hash', type: 'string', isOptional: true },
        { name: 'signature', type: 'string', isOptional: true },
        { name: 'hlc', type: 'string', isOptional: true },
        { name: 'error_reason', type: 'string', isOptional: true },
        { name: 'retry_count', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'sync_meta',
      columns: [
        { name: 'key', type: 'string', isIndexed: true },
        { name: 'value', type: 'string' },
      ],
    }),
    tableSchema({
      name: '_conflicts',
      columns: [
        { name: 'entity_id', type: 'string', isIndexed: true },
        { name: 'entity_type', type: 'string' },
        { name: 'server_data', type: 'string' },
        { name: 'server_revision', type: 'string' },
        { name: 'local_data', type: 'string', isOptional: true },
        { name: 'local_revision', type: 'string', isOptional: true },
        { name: 'conflict_reason', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
      ],
    }),
  ],
});
