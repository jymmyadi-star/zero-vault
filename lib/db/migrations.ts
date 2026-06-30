import { schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

export default schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        // v2 adds isIndexed:true to is_pending_delete, verified, record_id,
        // updated_at, revision, folder, entity_type, created_at.
        // WatermelonDB migrations cannot alter existing columns to add indexes.
        // ensureIndexes() in db/index.ts creates these via raw SQL at init time
        // for existing installs. New installs get them via schema DDL.
      ],
    },
  ],
});
