import * as SecureStore from 'expo-secure-store';

let MMKV: any;
try {
  MMKV = require('react-native-mmkv').MMKV;
} catch {}

const MMKV_ENCRYPTION_KEY = 'zerovault_mmkv_encryption_key';

interface StorageLike {
  getString(key: string): string | undefined;
  set(key: string, value: string | boolean | number): void;
  delete(key: string): void;
  getAllKeys(): string[];
}

class FallbackStorage implements StorageLike {
  private map = new Map<string, string | boolean | number>();

  getString(key: string): string | undefined {
    const val = this.map.get(key);
    return typeof val === 'string' ? val : undefined;
  }

  set(key: string, value: string | boolean | number): void {
    this.map.set(key, value);
  }

  delete(key: string): void {
    this.map.delete(key);
  }

  getAllKeys(): string[] {
    return Array.from(this.map.keys());
  }
}

async function getOrCreateEncryptionKey(): Promise<string> {
  try {
    const existing = await SecureStore.getItemAsync(MMKV_ENCRYPTION_KEY);
    if (existing) return existing;
  } catch {}

  const key = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  try {
    await SecureStore.setItemAsync(MMKV_ENCRYPTION_KEY, key);
  } catch {}

  return key;
}

let _storage: StorageLike | null = null;

function initMMKV(): StorageLike {
  if (!MMKV) return new FallbackStorage();

  let storage: StorageLike;
  try {
    storage = new MMKV({ id: 'zerovault-kv' });
  } catch {
    return new FallbackStorage();
  }

  getOrCreateEncryptionKey().then((encKey) => {
    try {
      const encrypted = new MMKV({ id: 'zerovault-kv-enc', encrypt: true, key: encKey });
      _storage = encrypted;
    } catch {
      // Encryption not supported by this MMKV version; keep unencrypted instance
    }
  }).catch(() => {});

  return storage;
}

function getOrCreateStorage(): StorageLike {
  if (_storage) return _storage;
  const s = initMMKV();
  _storage = s;
  return s;
}

export const kv = {
  get(key: string): string | undefined {
    return getOrCreateStorage().getString(key);
  },
  set(key: string, value: string): void {
    getOrCreateStorage().set(key, value);
  },
  delete(key: string): void {
    getOrCreateStorage().delete(key);
  },
  getAllKeys(): string[] {
    return getOrCreateStorage().getAllKeys();
  },
};
