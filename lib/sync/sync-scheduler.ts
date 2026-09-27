import { getIsOnline, onNetworkChange, initNetworkMonitor } from '../network-status';
import { pullChanges } from './pull';
import { drainBacklog } from './push';
import { Logger } from '../logger';

let schedulerStarted = false;
let pullTimer: ReturnType<typeof setInterval> | null = null;

const PULL_INTERVAL_MS = 60_000;

let lastPullTime = 0;
const MIN_PULL_GAP_MS = 5_000;

function throttledPull(): void {
  const now = Date.now();
  if (now - lastPullTime < MIN_PULL_GAP_MS) return;
  lastPullTime = now;

  pullChanges().catch(() => {});
  drainBacklog().catch(() => {});
}

export function startSyncScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;

  initNetworkMonitor();

  onNetworkChange((connected) => {
    if (connected) {
      Logger.info('Network restored — triggering sync', {
        module: 'SyncScheduler',
        event: 'reconnect',
      });
      throttledPull();
    }
  });

  pullTimer = setInterval(() => {
    if (getIsOnline()) {
      throttledPull();
    }
  }, PULL_INTERVAL_MS);

  pullChanges().catch(() => {});
  drainBacklog().catch(() => {});

  Logger.info('Sync scheduler started', { module: 'SyncScheduler', event: 'start' });
}

export function stopSyncScheduler(): void {
  schedulerStarted = false;

  if (pullTimer) {
    clearInterval(pullTimer);
    pullTimer = null;
  }

  Logger.info('Sync scheduler stopped', { module: 'SyncScheduler', event: 'stop' });
}
