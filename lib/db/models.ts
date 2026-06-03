import { Model } from '@nozbe/watermelondb';
import { field, text, readonly, date } from '@nozbe/watermelondb/decorators';

export class VaultItem extends Model {
  // @ts-expect-error WatermelonDB decorator pattern
  static table = 'vault_items';

  @text('item_type') itemType: any;
  @text('title') title: any;
  @text('folder') folder: any;
  @text('payload_ciphertext') payloadCiphertext: any;
  @field('favorite') favorite: any;
  @text('icon') icon: any;
  @text('url_hint') urlHint: any;
  @field('last_used_at') lastUsedAt: any;
  @field('created_at') createdAt: any;
  @field('updated_at') updatedAt: any;
  @text('revision') revision: any;
  @field('is_pending_delete') isPendingDelete: any;
}

export class SyncBacklog extends Model {
  // @ts-expect-error WatermelonDB decorator pattern
  static table = 'sync_backlog';

  @text('log_id') logId: any;
  @field('sequence') sequence: any;
  @text('table_name') tableName: any;
  @text('record_id') recordId: any;
  @text('operation') operation: any;
  @text('payload_ciphertext') payloadCiphertext: any;
  @text('new_revision') newRevision: any;
  @field('key_epoch_id') keyEpochId: any;
  @field('verified') verified: any;
  @text('prev_hash') prevHash: any;
  @text('signature') signature: any;
  @text('hlc') hlc: any;
  @text('error_reason') errorReason: any;
  @field('retry_count') retryCount: any;
  @field('created_at') createdAt: any;
}

export class SyncMeta extends Model {
  // @ts-expect-error WatermelonDB decorator pattern
  static table = 'sync_meta';

  @text('key') key: any;
  @text('value') value: any;
}

export class Conflict extends Model {
  // @ts-expect-error WatermelonDB decorator pattern
  static table = '_conflicts';

  @text('entity_id') entityId: any;
  @text('entity_type') entityType: any;
  @text('server_data') serverData: any;
  @text('server_revision') serverRevision: any;
  @text('local_data') localData: any;
  @text('local_revision') localRevision: any;
  @text('conflict_reason') conflictReason: any;
  @field('created_at') createdAt: any;
}
