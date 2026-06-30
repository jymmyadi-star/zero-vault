import type { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { Logger } from '../services/logger';
import * as net from 'net';

interface RateLimitStore {
  consume(key: string, windowMs: number, limit: number): Promise<{ allowed: boolean; remaining: number; resetMs: number }>;
}

class InMemoryStore implements RateLimitStore {
  private buckets = new Map<string, { tokens: number; lastRefill: number }>();

  async consume(key: string, windowMs: number, limit: number): Promise<{ allowed: boolean; remaining: number; resetMs: number }> {
    const now = Date.now();
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { tokens: limit, lastRefill: now };
      this.buckets.set(key, bucket);
    }
    const elapsed = now - bucket.lastRefill;
    const refill = Math.floor(elapsed * (limit / windowMs));
    bucket.tokens = Math.min(limit, bucket.tokens + refill);
    bucket.lastRefill = now;

    if (bucket.tokens < 1) {
      const resetMs = Math.ceil((1 - bucket.tokens) / (limit / windowMs));
      return { allowed: false, remaining: 0, resetMs };
    }
    bucket.tokens -= 1;
    return { allowed: true, remaining: bucket.tokens, resetMs: 0 };
  }
}

class RedisStore implements RateLimitStore {
  private socket: net.Socket | null = null;
  private pending: Array<{ resolve: (v: string) => void; reject: (e: Error) => void }> = [];
  private buffer = '';
  private connecting = false;

  constructor(private url: string) {}

  private connect(): Promise<void> {
    if (this.socket && !this.socket.destroyed) return Promise.resolve();
    if (this.connecting) return new Promise(r => setTimeout(() => r(this.connect()), 100));
    this.connecting = true;

    return new Promise((resolve, reject) => {
      const parsed = new URL(this.url);
      this.socket = net.createConnection({
        host: parsed.hostname || 'localhost',
        port: parseInt(parsed.port || '6379'),
      });
      this.socket.on('connect', () => { this.connecting = false; resolve(); });
      this.socket.on('error', (e) => { this.connecting = false; this.socket = null; reject(e); });
      this.socket.on('data', (chunk: Buffer) => {
        this.buffer += chunk.toString();
        const lines = this.buffer.split('\r\n');
        this.buffer = lines.pop() || '';
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]!;
          if (line.startsWith(':')) { i++; continue; }
          if (line.startsWith('*')) {
            const count = parseInt(line.slice(1));
            const results: string[] = [];
            for (let j = 0; j < count; j++) {
              i++;
              if (lines[i]?.startsWith('$')) {
                const len = parseInt(lines[i]!.slice(1));
                if (len === -1) { results.push('__nil__'); continue; }
                i++;
                results.push(lines[i]?.slice(0, len) ?? '');
              }
            }
            const pending = this.pending.shift();
            if (pending) pending.resolve(results[0] ?? '');
          } else if (line.startsWith('+')) {
            const pending = this.pending.shift();
            if (pending) pending.resolve(line.slice(1));
          } else if (line.startsWith('-')) {
            const pending = this.pending.shift();
            if (pending) pending.reject(new Error(line.slice(1)));
          } else if (line.startsWith(':')) {
            const pending = this.pending.shift();
            if (pending) pending.resolve(line.slice(1));
          }
        }
      });
      this.socket.on('close', () => { this.socket = null; });
    });
  }

  private async cmd(args: string[]): Promise<string> {
    await this.connect();
    if (!this.socket) throw new Error('Redis disconnected');
    return new Promise((resolve, reject) => {
      this.pending.push({ resolve, reject });
      const cmd = `*${args.length}\r\n${args.map(a => `$${Buffer.byteLength(a)}\r\n${a}\r\n`).join('')}`;
      this.socket!.write(cmd);
      setTimeout(() => {
        const idx = this.pending.findIndex(p => p.resolve === resolve && p.reject === reject);
        if (idx !== -1) { this.pending.splice(idx, 1); reject(new Error('timeout')); }
      }, 1000);
    });
  }

  async consume(key: string, windowMs: number, limit: number): Promise<{ allowed: boolean; remaining: number; resetMs: number }> {
    try {
      const now = Date.now();
      const windowKey = `ratelimit:${key}:${Math.floor(now / windowMs)}`;
      const count = parseInt(await this.cmd(['INCR', windowKey]));
      if (count === 1) {
        await this.cmd(['EXPIRE', windowKey, String(Math.ceil(windowMs / 1000))]);
      }
      if (count > limit) {
        return { allowed: false, remaining: 0, resetMs: windowMs - (now % windowMs) };
      }
      return { allowed: true, remaining: limit - count, resetMs: 0 };
    } catch (err) {
      Logger.warn('Redis rate limiter failed, falling back to in-memory', { error: (err as Error).message });
      const fallback = new InMemoryStore();
      return fallback.consume(key, windowMs, limit);
    }
  }
}

let store: RateLimitStore = new InMemoryStore();

// Periodic cleanup for in-memory store to prevent unbounded growth
const PRUNE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const BUCKET_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes
let pruneTimer: ReturnType<typeof setInterval> | null = null;

function startInMemoryPruning(): void {
  if (pruneTimer) return;
  pruneTimer = setInterval(() => {
    if (!(store instanceof InMemoryStore)) return;
    const now = Date.now();
    for (const [key, bucket] of store['buckets']) {
      if (now - bucket.lastRefill > BUCKET_MAX_AGE_MS) {
        store['buckets'].delete(key);
      }
    }
  }, PRUNE_INTERVAL_MS);
}

export function initRateLimitStore(): void {
  if (config.REDIS_ENABLED && config.REDIS_URL) {
    try {
      store = new RedisStore(config.REDIS_URL);
      Logger.info('Rate limiter using Redis');
    } catch (err) {
      Logger.warn('Failed to init Redis rate limiter, using in-memory', { error: (err as Error).message });
    }
  } else {
    Logger.info('Rate limiter using in-memory (single instance)');
    startInMemoryPruning();
  }
}

export function rateLimiter(windowMs = config.RATE_LIMIT_WINDOW_MS, max = config.RATE_LIMIT_MAX) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userId = req.user?.id;
    const key = userId ? `user:${userId}` : `ip:${ip}`;

    const result = await store.consume(key, windowMs, max);

    if (!result.allowed) {
      res.status(429).json({
        code: 'RATE_LIMITED',
        message: 'Too many requests. Retry later.',
        retryAfterMs: result.resetMs,
      });
      return;
    }

    res.setHeader('X-RateLimit-Remaining', String(result.remaining));
    next();
  };
}

export function getRateLimitStore(): RateLimitStore {
  return store;
}
