import type { Server as HttpServer, IncomingMessage } from 'http';
import type { Socket } from 'net';
import { Router } from 'express';
import { handleConnection, startHeartbeat, getConnectionStats } from './handlers.js';
import { Logger } from '../services/logger.js';
import { verifyJwt } from '../services/supabase.js';

const wsStatsRouter = Router();

wsStatsRouter.get('/stats', (_req, res) => {
  res.json(getConnectionStats());
});

const WebSocket = require('ws');

const WS_RATE_LIMIT_MAX = 30;
const WS_RATE_LIMIT_WINDOW_MS = 60_000;

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now - entry.windowStart > WS_RATE_LIMIT_WINDOW_MS) {
      rateLimitMap.delete(ip);
    }
  }
}, 30_000).unref();

interface AuthenticatedUpgradeRequest extends IncomingMessage {
  authenticatedUser?: { id: string; email: string | null; isAnonymous: boolean };
}

export function attachWebSocketServer(httpServer: HttpServer): any {
  const wss = new WebSocket.Server({
    noServer: true,
    maxPayload: 1024 * 1024,
  });

  let heartbeatTimer: NodeJS.Timeout | null = null;

  wss.on('listening', () => {
    Logger.info('WebSocket server listening', { path: '/ws' });
    heartbeatTimer = startHeartbeat();
  });

  wss.on('connection', (ws: any, req: AuthenticatedUpgradeRequest) => {
    if (!req.authenticatedUser) {
      ws.close(4001, 'Unauthorized');
      return;
    }
    handleConnection(ws, req.authenticatedUser);
  });

  wss.on('error', (err: Error) => {
    Logger.error('WebSocket server error', err);
  });

  wss.on('close', () => {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    Logger.info('WebSocket server shut down');
  });

  httpServer.on('upgrade', async (request: IncomingMessage, socket: Socket, head: Buffer) => {
    const url = new URL(request.url || '/', `http://${request.headers.host}`);
    if (url.pathname !== '/ws') {
      socket.destroy();
      return;
    }

    const ip = (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || socket.remoteAddress
      || 'unknown';

    const now = Date.now();
    let entry = rateLimitMap.get(ip);
    if (!entry || now - entry.windowStart > WS_RATE_LIMIT_WINDOW_MS) {
      entry = { count: 0, windowStart: now };
      rateLimitMap.set(ip, entry);
    }
    entry.count++;

    if (entry.count > WS_RATE_LIMIT_MAX) {
      Logger.warn('WebSocket upgrade rejected: rate limited', {
        module: 'WebSocket',
        ip,
        count: entry.count,
      });
      socket.write('HTTP/1.1 429 Too Many Requests\r\nRetry-After: 60\r\n\r\n');
      socket.destroy();
      return;
    }

    // Extract JWT — prefer Authorization header, fallback to query param
    let token: string | null = null;
    const authHeader = request.headers.authorization || request.headers['Authorization'];
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
    if (!token) {
      const queryToken = url.searchParams.get('token');
      if (queryToken) {
        token = queryToken;
      }
    }

    if (!token) {
      Logger.warn('WebSocket upgrade rejected: missing auth token', {
        module: 'WebSocket',
        ip: socket.remoteAddress,
      });
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    const user = await verifyJwt(token);
    if (!user) {
      Logger.warn('WebSocket upgrade rejected: invalid JWT', {
        module: 'WebSocket',
        ip: socket.remoteAddress,
      });
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    (request as AuthenticatedUpgradeRequest).authenticatedUser = user;

    wss.handleUpgrade(request, socket, head, (ws: any) => {
      wss.emit('connection', ws, request);
    });
  });

  return wss;
}

export { wsStatsRouter };
