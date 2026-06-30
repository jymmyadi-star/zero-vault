import 'dotenv/config';
import { createApp } from './app';
import { config } from './config';
import { Logger } from './services/logger';
import { attachWebSocketServer } from './ws';
import { initRateLimitStore } from './middleware/rate-limiter';

async function main(): Promise<void> {
  initRateLimitStore();
  const app = createApp();

  const server = app.listen(config.PORT, config.HOST, () => {
    Logger.info(`Zero Vault API server started`, {
      host: config.HOST,
      port: config.PORT,
      env: config.NODE_ENV,
      ws: 'enabled',
    });
  });

  const wss = attachWebSocketServer(server);

  const shutdown = (signal: string) => {
    Logger.info(`Received ${signal} — shutting down gracefully`);
    wss.close(() => {
      server.close(() => {
        Logger.info('Server shut down complete');
        process.exit(0);
      });
    });

    setTimeout(() => {
      Logger.warn('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    Logger.error('Unhandled rejection', reason instanceof Error ? reason : new Error(String(reason)));
  });
  process.on('uncaughtException', (err) => {
    Logger.error('Uncaught exception', err);
    process.exit(1);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
