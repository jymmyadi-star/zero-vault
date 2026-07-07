import type { VaultItem, DecryptedVaultItem, EncryptedEnvelope } from './types';
import { decryptPayload } from './crypto';

const DB_NAME = 'zerovault-extension';
const STORE_NAME = 'vault_items';
const META_STORE = 'meta';
const DB_VERSION = 1;

let db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(STORE_NAME)) {
        d.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!d.objectStoreNames.contains(META_STORE)) {
        d.createObjectStore(META_STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => { db = req.result; resolve(db); };
    req.onerror = () => reject(req.error);
  });
}

export async function storeVaultItems(items: VaultItem[]): Promise<void> {
  const d = await openDB();
  const tx = d.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  for (const item of items) {
    store.put(item);
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getVaultItems(): Promise<VaultItem[]> {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function decryptWithKey(items: VaultItem[], key: Uint8Array): Promise<DecryptedVaultItem[]> {
  const result: DecryptedVaultItem[] = [];
  for (const item of items) {
    if (item.isPendingDelete) continue;
    try {
      const envelope: EncryptedEnvelope = JSON.parse(item.payloadCiphertext);
      const payload = decryptPayload(envelope, key);
      result.push({
        id: item.id,
        itemType: item.itemType,
        title: item.title,
        folder: item.folder,
        payload,
        favorite: item.favorite,
        icon: item.icon,
        urlHint: item.urlHint,
        lastUsedAt: item.lastUsedAt,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      });
    } catch {}
  }
  result.sort((a, b) => (b.lastUsedAt || b.createdAt) - (a.lastUsedAt || a.createdAt));
  return result;
}

export async function setMeta(key: string, value: string): Promise<void> {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(META_STORE, 'readwrite');
    tx.objectStore(META_STORE).put({ key, value });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getMeta(key: string): Promise<string | null> {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(META_STORE, 'readonly');
    const req = tx.objectStore(META_STORE).get(key);
    req.onsuccess = () => resolve(req.result?.value || null);
    req.onerror = () => reject(req.error);
  });
}

export async function clearVault(): Promise<void> {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction([STORE_NAME, META_STORE], 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.objectStore(META_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// --- Configuration Storage (chrome.storage.local) ---

export interface VaultConfig {
  pairingId: string;
  wrappedCipherKey: { iv: string; ciphertext: string; tag: string };
  localSalt: string;
}

export async function setVaultConfig(config: VaultConfig): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ zerovault_config: config }, () => resolve());
  });
}

export async function getVaultConfig(): Promise<VaultConfig | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(['zerovault_config'], (result) => {
      resolve(result.zerovault_config || null);
    });
  });
}

export async function clearVaultConfig(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove(['zerovault_config'], () => resolve());
  });
}
