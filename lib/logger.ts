type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  error?: string;
  module: string;
  extra?: Record<string, unknown>;
}

function formatLog(entry: LogEntry): string {
  const timestamp = new Date().toISOString();
  const parts = [`[${timestamp}]`, `[${entry.level.toUpperCase()}]`, `[${entry.module}]`, entry.message];
  if (entry.error) parts.push(`\n  Error: ${entry.error}`);
  return parts.join(' ');
}

const noop = () => {};

export const Logger = {
  debug(message: string, meta?: { module?: string; [key: string]: unknown }) {
    if (__DEV__) {
      console.debug(formatLog({ level: 'debug', message, module: meta?.module || 'App', extra: meta }));
    }
  },
  info(message: string, meta?: { module?: string; event?: string; [key: string]: unknown }) {
    console.info(formatLog({ level: 'info', message, module: meta?.module || 'App', extra: meta }));
  },
  warn(message: string, meta?: { module?: string; [key: string]: unknown }) {
    console.warn(formatLog({ level: 'warn', message, module: meta?.module || 'App', extra: meta }));
  },
  error(message: string, error?: unknown, meta?: { module?: string; [key: string]: unknown }) {
    console.error(
      formatLog({
        level: 'error',
        message,
        error: error instanceof Error ? error.message : String(error),
        module: meta?.module || 'App',
        extra: meta,
      }),
    );
  },
};
