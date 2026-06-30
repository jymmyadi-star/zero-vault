import { Logger } from '../services/logger.js';
import { config } from '../config.js';

interface AuthenticatedUser {
  id: string;
  email: string | null;
}

interface Client {
  ws: any;
  userId: string;
  isAlive: boolean;
  lastMessageTime: number;
}

const WS_MSG_RATE_LIMIT_MS = 100; // max 10 messages/sec per connection
const clients = new Map<string, Set<Client>>();

export async function notifySyncAvailable(userId: string, count: number): Promise<void> {
  const userClients = clients.get(userId);
  if (!userClients || userClients.size === 0) return;

  const message = JSON.stringify({
    type: 'sync:available',
    data: { count, timestamp: new Date().toISOString() },
  });

  for (const client of userClients) {
    if (client.ws.readyState === 1) {
      client.ws.send(message);
    }
  }
}

export function broadcastToUser(userId: string, event: string, data: unknown): void {
  const userClients = clients.get(userId);
  if (!userClients) return;

  const message = JSON.stringify({ type: event, data });

  for (const client of userClients) {
    if (client.ws.readyState === 1) {
      client.ws.send(message);
    }
  }
}

export function handleConnection(ws: any, user: AuthenticatedUser): void {
  const client: Client = { ws, userId: user.id, isAlive: true, lastMessageTime: 0 };

  let userClients = clients.get(user.id);
  if (!userClients) {
    userClients = new Set();
    clients.set(user.id, userClients);
  }
  userClients.add(client);

  Logger.info('WebSocket client connected', { userId: user.id, clientCount: userClients.size });

  ws.send(JSON.stringify({ type: 'connected', data: { userId: user.id } }));

  ws.on('message', (raw: Buffer) => {
    const now = Date.now();
    if (now - client.lastMessageTime < WS_MSG_RATE_LIMIT_MS) return;
    client.lastMessageTime = now;

    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'ping') {
        client.isAlive = true;
        ws.send(JSON.stringify({ type: 'pong', data: { timestamp: Date.now() } }));
      }
    } catch {}
  });

  ws.on('pong', () => {
    client.isAlive = true;
  });

  ws.on('close', () => {
    userClients?.delete(client);
    if (userClients && userClients.size === 0) {
      clients.delete(user.id);
    }
    Logger.info('WebSocket client disconnected', {
      userId: user.id,
      remainingClients: userClients?.size || 0,
    });
  });

  ws.on('error', () => {
    userClients?.delete(client);
  });
}

export function startHeartbeat(): NodeJS.Timeout {
  return setInterval(() => {
    for (const [userId, userClients] of clients) {
      for (const client of userClients) {
        if (!client.isAlive) {
          client.ws.terminate();
          userClients.delete(client);
          Logger.info('WebSocket client timed out', { userId });
          continue;
        }
        client.isAlive = false;
        client.ws.ping();
      }
      if (userClients.size === 0) {
        clients.delete(userId);
      }
    }
  }, config.WS_HEARTBEAT_INTERVAL_MS);
}

export function getConnectionStats(): { totalUsers: number; totalConnections: number } {
  let totalConnections = 0;
  for (const userClients of clients.values()) {
    totalConnections += userClients.size;
  }
  return { totalUsers: clients.size, totalConnections };
}
