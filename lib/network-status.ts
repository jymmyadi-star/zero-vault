import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { Logger } from './logger';

type NetworkListener = (isConnected: boolean) => void;

let isOnline = true;
let listeners: NetworkListener[] = [];
let unsubscribe: (() => void) | null = null;

export function initNetworkMonitor(): void {
  if (unsubscribe) return;

  unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
    const connected = !!(state.isConnected && state.isInternetReachable !== false);
    if (connected !== isOnline) {
      isOnline = connected;
      Logger.info(`Network: ${connected ? 'online' : 'offline'}`, {
        module: 'NetworkMonitor',
        event: connected ? 'online' : 'offline',
      });
      for (const listener of listeners) {
        try { listener(connected); } catch {}
      }
    }
  });

  Logger.info('Network monitor initialized', { module: 'NetworkMonitor', event: 'init' });
}

export function getIsOnline(): boolean {
  return isOnline;
}

export function onNetworkChange(listener: NetworkListener): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function destroyNetworkMonitor(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  listeners = [];
}
