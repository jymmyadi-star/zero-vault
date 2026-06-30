type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const currentLevel = (process.env.LOG_LEVEL || 'info') as LogLevel;

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[currentLevel];
}

function format(level: LogLevel, message: string, data?: Record<string, unknown>): string {
  const timestamp = new Date().toISOString();
  const parts = [timestamp, `[${level.toUpperCase()}]`, message];
  if (data) {
    const safe = { ...data };
    delete safe.access_token;
    delete safe.refresh_token;
    delete safe.jwt;
    delete safe.password;
    parts.push(JSON.stringify(safe));
  }
  return parts.join(' ');
}

export const Logger = {
  debug(message: string, data?: Record<string, unknown>) {
    if (shouldLog('debug')) console.debug(format('debug', message, data));
  },
  info(message: string, data?: Record<string, unknown>) {
    if (shouldLog('info')) console.info(format('info', message, data));
  },
  warn(message: string, data?: Record<string, unknown>) {
    if (shouldLog('warn')) console.warn(format('warn', message, data));
  },
  error(message: string, err?: unknown, data?: Record<string, unknown>) {
    if (shouldLog('error')) {
      const errorData = err instanceof Error ? { error: err.message, stack: err.stack } : { error: String(err) };
      console.error(format('error', message, { ...errorData, ...data }));
    }
  },
};
