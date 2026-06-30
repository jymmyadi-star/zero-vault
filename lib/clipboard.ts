let clearTimer: ReturnType<typeof setTimeout> | null = null;
const DEFAULT_CLEAR_DELAY_MS = 15_000;
const MAX_CLEAR_DELAY_MS = 60_000;

export function copyToClipboard(text: string, clearAfterMs: number = DEFAULT_CLEAR_DELAY_MS): void {
  const delay = Math.min(Math.max(clearAfterMs, 1000), MAX_CLEAR_DELAY_MS);

  try {
    const Clipboard = require('expo-clipboard');
    Clipboard.setStringAsync(text);
  } catch {}

  if (clearTimer) clearTimeout(clearTimer);

  clearTimer = setTimeout(() => {
    try {
      const Clipboard = require('expo-clipboard');
      Clipboard.setStringAsync('');
    } catch {}
    clearTimer = null;
  }, delay);
}

export function clearClipboardNow(): void {
  if (clearTimer) {
    clearTimeout(clearTimer);
    clearTimer = null;
  }
  try {
    const Clipboard = require('expo-clipboard');
    Clipboard.setStringAsync('');
  } catch {}
}
