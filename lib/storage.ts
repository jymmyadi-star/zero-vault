let MMKV: any;
try {
  MMKV = require('react-native-mmkv').MMKV;
} catch {}

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

let _storage: StorageLike | null = null;

function getOrCreateStorage(): StorageLike {
  if (_storage) return _storage;
  if (MMKV) {
    try {
      _storage = new MMKV({ id: 'zerovault-kv' });
      return _storage!;
    } catch {}
  }
  _storage = new FallbackStorage();
  return _storage;
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
