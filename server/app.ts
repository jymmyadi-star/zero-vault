import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config, validate } from './config';
import { authenticate, requestId, requestLogger } from './middleware/auth';
import { rateLimiter, initRateLimitStore } from './middleware/rate-limiter';
import { errorHandler, notFound } from './middleware/error-handler';
import { Logger } from './services/logger';
import { authRouter } from './routers/auth';
import { syncRouter } from './routers/sync';
import { vaultRouter } from './routers/vault';
import { wsStatsRouter } from './ws';

export function createApp(): express.Application {
  validate();
  initRateLimitStore();

  const app = express();

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'", "https://*.supabase.co", "wss://*.supabase.co"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        formAction: ["'self'"],
        baseUri: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginResourcePolicy: { policy: 'same-origin' },
    hsts: {
      maxAge: 63072000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }));

  app.use(cors({
    origin: config.CORS_ORIGIN,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  }));

  app.use(compression());
  app.set('trust proxy', config.TRUST_PROXY);
  app.use(express.json({ limit: '1mb' }));
  app.use(requestId);
  app.use(requestLogger);

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  app.use('/api', rateLimiter());

  // Auth routes must bypass authenticate middleware (anonymous sign-in)
  app.use('/api/auth', authRouter);

  // Protected routes requiring valid JWT
  app.use('/api/sync', authenticate, syncRouter);
  app.use('/api/vault', authenticate, vaultRouter);
  app.use('/api/ws', authenticate, wsStatsRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
