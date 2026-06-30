import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';

process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.LOG_LEVEL = 'error';

const VALID_TOKEN = 'v.eyJhYWwiOiJhYWwxIn0.s';
const ANONYMOUS_TOKEN = 'a.eyJhYWwiOiJhYWwxIn0.s';

vi.mock('../services/supabase', () => ({
  getSupabaseForUser: (_jwt: string) => ({
    auth: {
      getUser: vi.fn(),
    },
    from: (table: string) => {
      if (table === 'sync_log') {
        return {
          insert: () => ({ error: null }),
          select: (cols: string) => ({
            gt: (_field: string, _val: number) => ({
              eq: (_f: string, _v: string) => ({
                order: (_f: string, _opts: any) => ({
                  limit: (n: number) => Promise.resolve({ data: [], error: null }),
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
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
          upsert: () => Promise.resolve({ error: null }),
          delete: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        };
      }
      return { select: () => ({}) };
    },
  }),
  verifyJwt: async (token: string) => {
    if (token.startsWith('v.')) return { id: 'test-user-id', email: 'user@test.com', isAnonymous: false };
    if (token.startsWith('a.')) return { id: 'anon-user-id', email: null, isAnonymous: true };
    return null;
  },
  signInAnonymous: async () => ({
    session: { access_token: 'test-token', refresh_token: 'refresh', expires_in: 3600 },
    user: { id: 'anon-id' },
  }),
}));

describe('API Integration', () => {
  let app: any;

  beforeAll(async () => {
    const { createApp } = await import('../app');
    app = createApp();
  });

  describe('GET /health', () => {
    it('returns ok', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
    });
  });

  describe('Authentication', () => {
    it('rejects missing auth header', async () => {
      const res = await request(app).get('/api/auth/session');
      expect(res.status).toBe(401);
    });

    it('rejects invalid auth header', async () => {
      const res = await request(app)
        .get('/api/auth/session')
        .set('Authorization', 'Bearer invalid.token');
      expect(res.status).toBe(401);
    });
  });

  describe('Sync push', () => {
    it('requires auth', async () => {
      const res = await request(app).post('/api/sync/push').send({ changes: [] });
      expect(res.status).toBe(401);
    });

    it('validates input schema', async () => {
      const res = await request(app)
        .post('/api/sync/push')
        .set('Authorization', `Bearer ${VALID_TOKEN}`)
        .send({ notChanges: true });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('rejects empty changes array', async () => {
      const res = await request(app)
        .post('/api/sync/push')
        .set('Authorization', `Bearer ${VALID_TOKEN}`)
        .send({ changes: [] });
      expect(res.status).toBe(400);
    });

    it('rejects oversized payload', async () => {
      const oversize = 'x'.repeat(500_001);
      const res = await request(app)
        .post('/api/sync/push')
        .set('Authorization', `Bearer ${VALID_TOKEN}`)
        .send({
          changes: [{
            entityId: 'item-1',
            entityType: 'vaultItem',
            operation: 'INSERT',
            payloadCiphertext: oversize,
            hlc: new Date().toISOString(),
          }],
        });
      expect(res.status).toBe(400);
    });

    it('rejects non-JSON payload', async () => {
      const res = await request(app)
        .post('/api/sync/push')
        .set('Authorization', `Bearer ${VALID_TOKEN}`)
        .send({
          changes: [{
            entityId: 'item-1',
            entityType: 'vaultItem',
            operation: 'INSERT',
            payloadCiphertext: 'not-json',
            hlc: new Date().toISOString(),
          }],
        });
      expect(res.status).toBe(400);
    });

    it('rejects >100 changes', async () => {
      const changes = Array.from({ length: 101 }, (_, i) => ({
        entityId: `item-${i}`,
        entityType: 'vaultItem',
        operation: 'INSERT' as const,
        payloadCiphertext: JSON.stringify({ test: true }),
        hlc: new Date().toISOString(),
      }));
      const res = await request(app)
        .post('/api/sync/push')
        .set('Authorization', `Bearer ${VALID_TOKEN}`)
        .send({ changes });
      expect(res.status).toBe(400);
    });

    it('accepts valid payload', async () => {
      const res = await request(app)
        .post('/api/sync/push')
        .set('Authorization', `Bearer ${VALID_TOKEN}`)
        .send({
          changes: [{
            entityId: 'item-1',
            entityType: 'vaultItem',
            operation: 'INSERT',
            payloadCiphertext: JSON.stringify({ envelope: {}, wrappedDek: {}, chain: { prev_hash: null, signature: 'aa' } }),
            hlc: new Date().toISOString(),
          }],
        });
      expect(res.status).toBe(200);
      expect(res.body.accepted).toBe(1);
      expect(res.body.rejected).toBe(0);
    });
  });

  describe('Sync pull', () => {
    it('requires auth', async () => {
      const res = await request(app).get('/api/sync/pull');
      expect(res.status).toBe(401);
    });

    it('validates query params', async () => {
      const res = await request(app)
        .get('/api/sync/pull?sinceId=abc')
        .set('Authorization', `Bearer ${VALID_TOKEN}`);
      expect(res.status).toBe(400);
    });

    it('returns empty logs for fresh user', async () => {
      const res = await request(app)
        .get('/api/sync/pull?sinceId=0&pageSize=10')
        .set('Authorization', `Bearer ${VALID_TOKEN}`);
      expect(res.status).toBe(200);
      expect(res.body.logs).toEqual([]);
      expect(res.body.lastId).toBe(0);
      expect(res.body.hasMore).toBe(false);
    });

    it('clamps pageSize to max', async () => {
      const res = await request(app)
        .get('/api/sync/pull?sinceId=0&pageSize=1000')
        .set('Authorization', `Bearer ${VALID_TOKEN}`);
      expect(res.status).toBe(200);
      expect(res.body.logs).toEqual([]);
    });
  });

  describe('Sync status', () => {
    it('requires auth', async () => {
      const res = await request(app).get('/api/sync/status');
      expect(res.status).toBe(401);
    });

    it('returns lastId', async () => {
      const res = await request(app)
        .get('/api/sync/status')
        .set('Authorization', `Bearer ${VALID_TOKEN}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('lastId');
    });
  });

  describe('Vault seed', () => {
    it('requires auth for POST', async () => {
      const res = await request(app).post('/api/vault/seed').send({});
      expect(res.status).toBe(401);
    });

    it('requires identity for POST', async () => {
      const res = await request(app)
        .post('/api/vault/seed')
        .set('Authorization', `Bearer ${ANONYMOUS_TOKEN}`)
        .send({ deviceSalt: 'aa', wrappedVaultKey: 'bb', wrappedCipherKey: 'cc', wrappedSignKey: 'dd', pinVerifyHash: 'ee' });
      expect(res.status).toBe(403);
    });
  });

  describe('404 handling', () => {
    it('returns structured 404 for unknown routes', async () => {
      const res = await request(app).get('/nonexistent-route');
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('code', 'NOT_FOUND');
    });

    it('returns 404 for unknown API route', async () => {
      const res = await request(app).get('/api/unknown');
      expect(res.status).toBe(404);
    });
  });
});
