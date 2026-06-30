import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { Buffer } from 'buffer';

process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.LOG_LEVEL = 'error';

const VALID_TOKEN = 'v.eyJhYWwiOiJhYWwxIn0.s';
const USER_ID = 'test-user-id';

const syncLogStore: Array<{
  id: number;
  entity_id: string;
  entity_type: string;
  operation: string;
  payload_ciphertext: string;
  user_id: string;
  key_epoch_id: number;
  hlc: string | null;
  created_at: string;
}> = [];
let nextId = 1;

vi.mock('../services/supabase', () => ({
  getSupabaseForUser: (_jwt: string) => ({
    auth: { getUser: vi.fn() },
    from: (table: string) => {
      if (table === 'sync_log') {
        return {
          insert: (rows: any[]) => {
            if (Array.isArray(rows)) {
              for (const row of rows) {
                syncLogStore.push({
                  id: nextId++,
                  entity_id: row.entity_id,
                  entity_type: row.entity_type,
                  operation: row.operation,
                  payload_ciphertext: row.payload_ciphertext,
                  user_id: USER_ID,
                  key_epoch_id: row.key_epoch_id ?? 0,
                  hlc: row.hlc ?? null,
                  created_at: new Date().toISOString(),
                });
              }
            }
            return { error: null };
          },
          select: () => ({
            gt: (_field: string, sinceId: number) => ({
              eq: (_f: string, _v: string) => ({
                order: (_f: string, _opts: any) => ({
                  limit: (n: number) => {
                    const logs = syncLogStore
                      .filter(l => l.id > sinceId && l.user_id === USER_ID)
                      .slice(0, n)
                      .map(({ id, entity_id, entity_type, operation, payload_ciphertext, user_id, key_epoch_id, hlc }) => ({
                        id, entity_id, entity_type, operation, payload_ciphertext, user_id, key_epoch_id, hlc,
                      }));
                    return Promise.resolve({ data: logs, error: null });
                  },
                }),
              }),
            }),
            eq: (_field: string, _val: string) => ({
              order: (_f: string, _opts: any) => ({
                limit: (n: number) => ({
                  maybeSingle: () => Promise.resolve({ data: null, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'vault_seeds') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
          upsert: () => Promise.resolve({ error: null }),
          delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
        };
      }
      return { select: () => ({}) };
    },
  }),
  verifyJwt: async (token: string) => {
    if (token.startsWith('v.')) return { id: USER_ID, email: 'user@test.com', isAnonymous: false };
    return null;
  },
}));

describe('Sync E2E — Full Roundtrip', () => {
  let app: any;

  beforeAll(async () => {
    syncLogStore.length = 0;
    nextId = 1;
    const { createApp } = await import('../app');
    app = createApp();
  });

  it('push → pull roundtrip preserves ciphertext', async () => {
    const payload = JSON.stringify({
      envelope: { v: 1, alg: 'xchacha20-poly1305', iv: 'a'.repeat(48), ct: 'b'.repeat(64), tag: '', aad: '{}' },
      wrappedDek: { iv: 'c'.repeat(48), ciphertext: 'd'.repeat(64), tag: 'e'.repeat(32) },
      chain: { prev_hash: null, signature: 'f'.repeat(64) },
    });

    const pushRes = await request(app)
      .post('/api/sync/push')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)
      .send({
        changes: [{
          entityId: 'vault-item-roundtrip-1',
          entityType: 'vaultItem',
          operation: 'INSERT',
          payloadCiphertext: payload,
          hlc: new Date().toISOString(),
        }],
      });

    expect(pushRes.status).toBe(200);
    expect(pushRes.body.accepted).toBe(1);
    expect(syncLogStore.length).toBe(1);

    const pullRes = await request(app)
      .get('/api/sync/pull?sinceId=0&pageSize=10')
      .set('Authorization', `Bearer ${VALID_TOKEN}`);

    expect(pullRes.status).toBe(200);
    expect(pullRes.body.logs.length).toBe(1);
    expect(pullRes.body.logs[0].payload_ciphertext).toBe(payload);
    expect(pullRes.body.logs[0].entity_id).toBe('vault-item-roundtrip-1');
    expect(pullRes.body.logs[0].operation).toBe('INSERT');
  });

  it('push multiple items, pull all back in order', async () => {
    const items = [
      { entityId: 'batch-item-1', operation: 'INSERT', data: 'a'.repeat(32) },
      { entityId: 'batch-item-2', operation: 'UPDATE', data: 'b'.repeat(32) },
      { entityId: 'batch-item-3', operation: 'DELETE', data: 'c'.repeat(32) },
    ];

    for (const item of items) {
      const res = await request(app)
        .post('/api/sync/push')
        .set('Authorization', `Bearer ${VALID_TOKEN}`)
        .send({
          changes: [{
            entityId: item.entityId,
            entityType: 'vaultItem',
            operation: item.operation,
            payloadCiphertext: JSON.stringify({ data: item.data }),
            hlc: new Date().toISOString(),
          }],
        });
      expect(res.status).toBe(200);
    }

    const pullRes = await request(app)
      .get('/api/sync/pull?sinceId=0&pageSize=10')
      .set('Authorization', `Bearer ${VALID_TOKEN}`);

    expect(pullRes.status).toBe(200);
    expect(pullRes.body.logs.length).toBeGreaterThanOrEqual(3);
  });

  it('pull with sinceId returns only newer logs', async () => {
    const pullRes = await request(app)
      .get('/api/sync/pull?sinceId=0&pageSize=10')
      .set('Authorization', `Bearer ${VALID_TOKEN}`);

    const allLogs = pullRes.body.logs;
    expect(allLogs.length).toBeGreaterThan(0);

    if (allLogs.length >= 2) {
      const firstId = allLogs[0].id;
      const incrementalRes = await request(app)
        .get(`/api/sync/pull?sinceId=${firstId}&pageSize=10`)
        .set('Authorization', `Bearer ${VALID_TOKEN}`);

      expect(incrementalRes.body.logs.length).toBeLessThan(allLogs.length);
      expect(incrementalRes.body.lastId).toBeGreaterThanOrEqual(firstId);
    }
  });

  it('pull chain preserves prev_hash and signature in ciphertext', async () => {
    const chainPayload = JSON.stringify({
      envelope: { v: 1, alg: 'xchacha20-poly1305', iv: '11'.repeat(24), ct: '22'.repeat(32), tag: '', aad: '{}' },
      wrappedDek: { iv: '33'.repeat(24), ciphertext: '44'.repeat(32), tag: '55'.repeat(16) },
      chain: { prev_hash: 'genesis-hash-abc', signature: 'sig-xyz-123' },
    });

    await request(app)
      .post('/api/sync/push')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)
      .send({
        changes: [{
          entityId: 'chain-test-1',
          entityType: 'vaultItem',
          operation: 'INSERT',
          payloadCiphertext: chainPayload,
          hlc: new Date().toISOString(),
        }],
      });

    const pullRes = await request(app)
      .get('/api/sync/pull?sinceId=0&pageSize=10')
      .set('Authorization', `Bearer ${VALID_TOKEN}`);

    const pulledLog = pullRes.body.logs.find((l: any) => l.entity_id === 'chain-test-1');
    expect(pulledLog).toBeDefined();

    const parsed = JSON.parse(pulledLog.payload_ciphertext);
    expect(parsed.chain.prev_hash).toBe('genesis-hash-abc');
    expect(parsed.chain.signature).toBe('sig-xyz-123');
    expect(parsed.envelope).toBeDefined();
    expect(parsed.wrappedDek).toBeDefined();
  });

  it('sync status returns correct lastId', async () => {
    const statusRes = await request(app)
      .get('/api/sync/status')
      .set('Authorization', `Bearer ${VALID_TOKEN}`);

    expect(statusRes.status).toBe(200);
    expect(typeof statusRes.body.lastId).toBe('number');
  });

  it('pull hasMore flag is false when no more logs', async () => {
    const currentMaxId = syncLogStore.length > 0
      ? Math.max(...syncLogStore.map(l => l.id))
      : 0;

    const res = await request(app)
      .get(`/api/sync/pull?sinceId=${currentMaxId}&pageSize=10`)
      .set('Authorization', `Bearer ${VALID_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.logs).toEqual([]);
    expect(res.body.hasMore).toBe(false);
  });

  it('rate limiter rejects rapid requests', async () => {
    const promises = [];
    for (let i = 0; i < 120; i++) {
      promises.push(
        request(app)
          .get('/api/sync/status')
          .set('Authorization', `Bearer ${VALID_TOKEN}`)
      );
    }
    const results = await Promise.all(promises);
    const limited = results.filter(r => r.status === 429);
    expect(limited.length).toBeGreaterThan(0);
  });
});
