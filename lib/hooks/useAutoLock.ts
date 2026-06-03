import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useVaultStore } from '../store/vault-store';
import { kv } from '../storage';

const IDLE_TIMEOUT_KEY = 'zerovault_idle_timeout_minutes';
const DEFAULT_IDLE_MINUTES = 5;
const CHECK_INTERVAL_MS = 10_000;

/**
 * Module-level timestamp — shared between the hook (which reads it)
 * and resetActivityTimer() (which writes it). This is the fix for the
 * no-op bug where the ref was private to the hook and could never be
 * updated from touch handlers outside the component tree.
 */
let _lastActivityMs: number = Date.now();

/**
 * Call this from any touch handler, scroll, or interaction anywhere
 * in the app to reset the auto-lock idle countdown.
 * Previously this was a no-op stub — now it actually works.
 */
export function resetActivityTimer(): void {
  _lastActivityMs = Date.now();
}

export function useAutoLock(): void {
  const { status, lock } = useVaultStore();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getIdleMinutes = (): number => {
    const val = kv.get(IDLE_TIMEOUT_KEY);
    if (val) {
      const parsed = parseInt(val, 10);
      return isNaN(parsed) || parsed < 1 ? DEFAULT_IDLE_MINUTES : parsed;
    }
    return DEFAULT_IDLE_MINUTES;
  };

  // Reset activity timestamp whenever the app comes back to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        resetActivityTimer();
      }
    });
    return () => sub.remove();
  }, []);

  // Poll every 10s and lock if idle
  useEffect(() => {
    if (status !== 'unlocked') {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // Reset on unlock so the timer starts fresh
    resetActivityTimer();

    timerRef.current = setInterval(() => {
      const idleMs = getIdleMinutes() * 60_000;
      const elapsed = Date.now() - _lastActivityMs;

      if (elapsed >= idleMs) {
        lock();
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [status, lock]);
}
