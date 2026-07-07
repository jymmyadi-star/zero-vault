import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';

process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.LOG_LEVEL = 'error';

const VALID_TOKEN = 'v.eyJhYWwiOiJhYWwxIn0.s';

// We mock Supabase to simulate a slow insert,
// forcing the requests to overlap and test the Mutex.
vi.mock('../services/supabase', () => ({
  getSupabaseForUser: (_jwt: string) => ({
    from: (table: string) => {
      if (table === 'sync_log') {
        return {
          insert: async () => {
            // Simulate 50ms latency for DB write to ensure overlap
            await new Promise(r => setTimeout(r, 50));
            return { error: null };
          },
          select: (cols: string) => ({
            eq: (_field: string, _val: string) => ({
              order: (_f: string, _opts: any) => ({
                limit: (n: number) => ({
                  maybeSingle: () => Promise.resolve({ data: { payload_ciphertext: '{"chain":{"signature":"last-hash"}}' }, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      return { select: () => ({}) };
    },
  }),
  verifyJwt: async (token: string) => {
    return { id: 'test-concurrency-user', email: 'concurrency@test.com', isAnonymous: false };
  },
  getSupabaseAnon: () => ({}),
}));

describe('Sync Concurrency Mutex', () => {
  let app: any;

  beforeAll(async () => {
    const { createApp } = await import('../app');
    app = createApp();
  });

  it('serializes concurrent push requests using Mutex', async () => {
    // We send 3 push requests at the exact same time
    const start = Date.now();
    const requests = [1, 2, 3].map(i =>
      request(app)
        .post('/api/sync/push')
        .set('Authorization', `Bearer ${VALID_TOKEN}`)
        .send({
          changes: [{
            entityId: `item-${i}`,
            entityType: 'vaultItem',
            operation: 'INSERT',
            payloadCiphertext: JSON.stringify({ envelope: {}, wrappedDek: {}, chain: { prev_hash: 'last-hash', signature: `sig-${i}` } }),
            hlc: new Date().toISOString(),
          }],
        })
    );

    const responses = await Promise.all(requests);
    const end = Date.now();

    // All 3 should succeed
    responses.forEach(res => {
      expect(res.status).toBe(200);
      expect(res.body.accepted).toBe(1);
    });

    // Because each mocked DB insert takes 50ms, and they are protected by a Mutex,
    // they should run sequentially (50ms + 50ms + 50ms) rather than in parallel (max 50ms).
    // Thus the total time should be at least ~150ms.
    const duration = end - start;
    expect(duration).toBeGreaterThanOrEqual(140); // 140ms to account for slight timer variations
  });
});
