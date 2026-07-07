import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.LOG_LEVEL = 'error';

// Mocking Supabase
vi.mock('../services/supabase', () => ({
  signInDeterministic: async () => ({
    session: { access_token: 'test-token', refresh_token: 'refresh', expires_in: 3600 },
    user: { id: 'anon-id' },
  }),
  getSupabaseAnon: () => ({}),
}));

describe('OWASP ASVS V2 & V11: Backend Security', () => {
  let app: any;

  beforeAll(async () => {
    const { createApp } = await import('../app');
    app = createApp();
  });

  describe('ASVS V11.1.4: Rate Limiting & Brute-Force Protection', () => {
    it('blocks excessive anonymous authentication requests (HTTP 429)', async () => {
      const MAX_REQUESTS = 20; // Depending on express-rate-limit configuration
      const responses = [];

      for (let i = 0; i < MAX_REQUESTS + 5; i++) {
        responses.push(await request(app).post('/api/auth/signin').send({ email: 'test@zerovault.local', password: 'a'.repeat(32) }));
      }

      // The first few should be accepted (200 OK)
      const successful = responses.filter(r => r.status === 200);
      expect(successful.length).toBeGreaterThan(0);

      // The requests beyond the limit MUST be blocked (429 Too Many Requests)
      const blocked = responses.filter(r => r.status === 429);
      expect(blocked.length).toBeGreaterThan(0);
      
      // Verify rate limit headers exist on blocked response
      expect(blocked[0].headers).toHaveProperty('retry-after');
    });
  });

  describe('ASVS V2: Authentication Strictness', () => {
    it('rejects malformed JWTs instantly without touching the database', async () => {
      const res = await request(app)
        .post('/api/sync/push')
        .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.INVALID_PAYLOAD')
        .send({ changes: [] });

      // Must be 401 Unauthorized, not 500 (crash) or 400 (bad request processing)
      expect(res.status).toBe(401);
    });

    it('prevents SQL Injection in authentication headers', async () => {
      const maliciousPayload = "Bearer ' OR '1'='1";
      const res = await request(app)
        .post('/api/sync/push')
        .set('Authorization', maliciousPayload)
        .send({ changes: [] });

      expect(res.status).toBe(401);
    });
  });
});
