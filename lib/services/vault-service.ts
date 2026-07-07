// Re-export adapter — all operations now use Drizzle (expo-sqlite) backend.
// Old function names preserved for backward compatibility across 11 importers.

import { useVaultStore } from '../store/vault-store';
import {
  createV2VaultItem,
  getV2VaultItems,
  getV2VaultItemById,
  updateV2VaultItem,
  deleteV2VaultItem,
} from './vault-service-v2';
import { validatePayload, type VaultItemType, type VaultPayload } from '../validation/vault-schemas';
import { onVaultItemChanged } from '../sync/index';
import { Logger } from '../logger';

export type VaultItemType2 = VaultItemType;

export interface DecryptedVaultItem {
  id: string;
  itemType: 'password' | 'seed' | 'note';
  title: string;
  folder: string | null;
  payload: Record<string, unknown>;
  favorite: boolean;
  icon: string | null;
  urlHint: string | null;
  lastUsedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

function assertUnlocked(): { cipherKey: Uint8Array } {
  const { cipherKey, status } = useVaultStore.getState();
  if (status !== 'unlocked' || !cipherKey || (cipherKey as any).disposed) {
    throw new Error('Vault is locked');
  }
  return { cipherKey: cipherKey.copy() };
}

export async function createVaultItem(
  itemType: VaultItemType,
  title: string,
  payload: VaultPayload,
  opts?: { folder?: string; favorite?: boolean; icon?: string; urlHint?: string },
): Promise<DecryptedVaultItem> {
  const valid = validatePayload(itemType, payload);
  if (!valid.success) throw new Error(`Validation failed: ${(valid as any).error}`);
  const keys = assertUnlocked();
  const plainPayload = payload as unknown as Record<string, unknown>;
  try {
    const v2Type = itemType === 'seed_phrase' ? 'seed' as const : itemType as 'password' | 'seed' | 'note';
    const item = await createV2VaultItem(v2Type, title, plainPayload, keys.cipherKey, opts);
    onVaultItemChanged('INSERT', item.id, item.payload).catch(() => {});
    return item;
  } finally {
    keys.cipherKey.fill(0);
  }
}

export async function updateVaultItem(
  id: string,
  updates: Record<string, unknown>,
): Promise<DecryptedVaultItem | null> {
  const keys = assertUnlocked();
  try {
    const actualUpdates: Record<string, unknown> = {};
    if (typeof updates.title === 'string') actualUpdates.title = updates.title;
    if (typeof updates.folder === 'string' || updates.folder === null) actualUpdates.folder = updates.folder;
    if (updates.payload && typeof updates.payload === 'object') actualUpdates.payload = updates.payload;
    if (updates.plainPayload && typeof updates.plainPayload === 'object') actualUpdates.payload = updates.plainPayload;
    if (typeof updates.favorite === 'boolean') actualUpdates.favorite = updates.favorite;
    if (typeof updates.icon === 'string' || updates.icon === null) actualUpdates.icon = updates.icon;
    if (typeof updates.urlHint === 'string' || updates.urlHint === null) actualUpdates.urlHint = updates.urlHint;
    const updated = await updateV2VaultItem(id, actualUpdates as any, keys.cipherKey);
    if (updated) onVaultItemChanged('UPDATE', id, updated.payload).catch(() => {});
    return updated;
  } finally {
    keys.cipherKey.fill(0);
  }
}

export async function getVaultItemById(id: string): Promise<DecryptedVaultItem | null> {
  const keys = assertUnlocked();
  try {
    return await getV2VaultItemById(id, keys.cipherKey);
  } finally {
    keys.cipherKey.fill(0);
  }
}

export async function deleteVaultItem(id: string): Promise<void> {
  await deleteV2VaultItem(id);
  onVaultItemChanged('DELETE', id, {}).catch(() => {});
}

export async function toggleFavorite(id: string): Promise<boolean> {
  const item = await getVaultItemById(id);
  if (!item) return false;
  const updated = await updateVaultItem(id, { favorite: !item.favorite });
  return updated?.favorite ?? false;
}

export async function decryptVaultItem(raw: { id: string; itemType?: string; title?: string; payloadCiphertext: string; folder?: string | null; favorite?: boolean; icon?: string | null; urlHint?: string | null; lastUsedAt?: number | null; createdAt?: number; updatedAt?: number }): Promise<DecryptedVaultItem | null> {
  const keys = assertUnlocked();
  try {
    const item = await getV2VaultItemById(raw.id, keys.cipherKey);
    return item;
  } finally {
    keys.cipherKey.fill(0);
  }
}

export interface VaultItemMetadata {
  id: string;
  itemType: string;
  title: string;
  folder: string | null;
  favorite: boolean;
  icon: string | null;
  urlHint: string | null;
  lastUsedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export async function queryVaultItems(_filter?: Record<string, unknown>): Promise<VaultItemMetadata[]> {
  const keys = assertUnlocked();
  try {
    const items = await getV2VaultItems(keys.cipherKey);
    return items.map((item) => ({
      id: item.id,
      itemType: item.itemType,
      title: item.title,
      folder: item.folder,
      favorite: item.favorite,
      icon: item.icon,
      urlHint: item.urlHint,
      lastUsedAt: item.lastUsedAt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));
  } finally {
    keys.cipherKey.fill(0);
  }
}

export { validatePayload, onVaultItemChanged };
