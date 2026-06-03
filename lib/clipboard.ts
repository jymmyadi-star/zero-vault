let clearTimer: ReturnType<typeof setTimeout> | null = null;
const DEFAULT_CLEAR_DELAY_MS = 30_000;

export function copyToClipboard(text: string, clearAfterMs: number = DEFAULT_CLEAR_DELAY_MS): void {
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
  }, clearAfterMs);
}

export function cancelClipboardClear(): void {
  if (clearTimer) {
    clearTimeout(clearTimer);
    clearTimer = null;
  }
}
