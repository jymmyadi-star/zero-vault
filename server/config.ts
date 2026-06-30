const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '4000', 10),
  HOST: process.env.HOST || '0.0.0.0',

  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',

  REDIS_URL: process.env.REDIS_URL || '',
  REDIS_ENABLED: process.env.REDIS_URL ? true : false,

  CORS_ORIGIN: process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'production' ? '' : '*'),

  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),

  WS_HEARTBEAT_INTERVAL_MS: parseInt(process.env.WS_HEARTBEAT_INTERVAL_MS || '30000', 10),
  WS_CLIENT_TIMEOUT_MS: parseInt(process.env.WS_CLIENT_TIMEOUT_MS || '60000', 10),

  TRUST_PROXY: process.env.TRUST_PROXY || (process.env.NODE_ENV === 'production' ? '1' : '0'),

  SYNC_PAGE_SIZE: parseInt(process.env.SYNC_PAGE_SIZE || '200', 10),
  SYNC_MAX_PAGE_SIZE: parseInt(process.env.SYNC_MAX_PAGE_SIZE || '500', 10),

  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
} as const;

export type Config = typeof env;

function validate(): void {
  const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'] as const;
  const missing = required.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  if (env.NODE_ENV === 'production' && env.CORS_ORIGIN === '*') {
    throw new Error('CORS_ORIGIN must be set to a specific origin in production');
  }
}

export { env as config, validate };
