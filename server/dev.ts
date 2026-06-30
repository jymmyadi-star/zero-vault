import express from 'express';
import cors from 'cors';
import compression from 'compression';

const PORT = 4000;
const app = express();

app.use((req, res, next) => {
  const host = req.hostname || req.ip || '';
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.startsWith('192.168.') || host.startsWith('10.')) {
    next();
  } else {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Dev server only accessible from localhost' });
  }
});

app.use(cors());
app.use(compression());
app.use(express.json({ limit: '1mb' }));

// In-memory stores
const users = new Map<string, { id: string; email: string | null; isAnonymous: boolean }>();
const syncLogs: any[] = [];
const vaultSeeds = new Map<string, any>();
let nextSyncId = 1;
let nextUserId = 1;

function createAnonUser() {
  const id = `anon-${nextUserId++}`;
  const user = { id, email: `anon_${Date.now()}@anonymous.local`, isAnonymous: true };
  users.set(id, user);
  return user;
}

function auth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ code: 'UNAUTHORIZED', message: 'Missing token' });
    return;
  }
  const token = authHeader.slice(7);
  // Token format: "token:USERID"
  const parts = token.split(':');
  if (parts.length !== 2 || !users.has(parts[1]!)) {
    res.status(401).json({ code: 'UNAUTHORIZED', message: 'Invalid token' });
    return;
  }
  (req as any).user = users.get(parts[1]!);
  next();
}

function requireIdentity(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = (req as any).user;
  if (!user || user.isAnonymous) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Identity required' });
    return;
  }
  next();
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0', uptime: process.uptime() });
});

app.post('/api/auth/anonymous', (_req, res) => {
  const user = createAnonUser();
  const token = `token:${user.id}`;
  res.json({ accessToken: token, refreshToken: 'refresh', expiresIn: 3600, userId: user.id });
});

app.get('/api/auth/session', auth, (req, res) => {
  res.json((req as any).user);
});

app.post('/api/sync/push', auth, (req, res) => {
  const { changes } = req.body || {};
  if (!Array.isArray(changes) || changes.length === 0 || changes.length > 100) {
    res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid changes array' });
    return;
  }
  const user = (req as any).user;
  for (const c of changes) {
    syncLogs.push({ id: nextSyncId++, entity_id: c.entityId, entity_type: c.entityType,
      operation: c.operation, payload_ciphertext: c.payloadCiphertext,
      new_revision: c.newRevision, user_id: user.id, key_epoch_id: c.keyEpochId || 0,
      hlc: c.hlc, created_at: new Date().toISOString() });
  }
  res.json({ accepted: changes.length, rejected: 0 });
});

app.get('/api/sync/pull', auth, (req, res) => {
  const sinceId = parseInt(req.query.sinceId as string) || 0;
  const pageSize = Math.min(parseInt(req.query.pageSize as string) || 200, 500);
  const user = (req as any).user;
  const filtered = syncLogs.filter((l) => l.id > sinceId && l.user_id === user.id);
  const sliced = filtered.slice(0, pageSize + 1);
  const hasMore = sliced.length > pageSize;
  const logs = hasMore ? sliced.slice(0, pageSize) : sliced;
  const lastId = logs.length > 0 ? logs[logs.length - 1]!.id : sinceId;
  res.json({ logs, hasMore, lastId });
});

app.get('/api/sync/status', auth, (req, res) => {
  const user = (req as any).user;
  const userLogs = syncLogs.filter((l) => l.user_id === user.id);
  const last = userLogs[userLogs.length - 1];
  res.json({ lastId: last?.id || 0 });
});

app.post('/api/vault/seed', auth, (req, res) => {
  const { deviceSalt, wrappedVaultKey, wrappedCipherKey, wrappedSignKey, pinVerifyHash } = req.body || {};
  if (!deviceSalt || !wrappedVaultKey || !wrappedCipherKey || !wrappedSignKey || !pinVerifyHash) {
    res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Missing seed fields' });
    return;
  }
  vaultSeeds.set((req as any).user.id, { ...req.body, updated_at: new Date().toISOString() });
  res.json({ success: true });
});

app.get('/api/vault/seed', auth, (req, res) => {
  const seed = vaultSeeds.get((req as any).user.id);
  if (!seed) { res.json(null); return; }
  res.json(seed);
});

app.delete('/api/vault/seed', auth, (req, res) => {
  vaultSeeds.delete((req as any).user.id);
  res.json({ success: true });
});

app.head('/api/vault/seed', auth, (_req, res) => {
  const seed = vaultSeeds.get((_req as any).user.id);
  res.status(seed ? 200 : 404).end();
});

const server = app.listen(PORT, () => {
  console.log(`\n  Zero Vault DEV server → http://localhost:${PORT}`);
  console.log(`  Extension auth: any request with token "token:USERID"\n`);
});
