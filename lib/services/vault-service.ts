import { getDatabase } from '../db';
import { useVaultStore } from '../store/vault-store';
import { encryptPayload, decryptPayload, type EncryptedEnvelope } from '../crypto/crypto-utils';
import { validatePayload, type VaultItemType, type VaultPayload } from '../validation/vault-schemas';
import { onVaultItemChanged } from '../sync/index';
import { Logger } from '../logger';

export type DecryptedVaultItem = {
  id: string;
  itemType: VaultItemType;
  title: string;
  folder: string | null;
  payload: VaultPayload;
  favorite: boolean;
  icon: string | null;
  urlHint: string | null;
  lastUsedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export type VaultItemMetadata = {
  id: string;
  itemType: string;
  title: string;
  folder: string | null;
  icon: string | null;
  urlHint: string | null;
  favorite: boolean;
  lastUsedAt: number | null;
  createdAt: number;
};

function assertUnlocked(): Uint8Array {
  const { cipherKey, status } = useVaultStore.getState();
  if (!cipherKey) throw new Error(`VAULT_LOCKED: cipherKey not available (Status: ${status})`);
  return cipherKey.copy();
}

export async function createVaultItem(
  type: VaultItemType,
  title: string,
  plainPayload: Record<string, unknown>,
  metadata?: {
    folder?: string;
    icon?: string;
    urlHint?: string;
    favorite?: boolean;
  },
): Promise<string> {
  const validation = validatePayload(type, plainPayload);
  if (!validation.success) {
    throw new Error(validation.error);
  }

  const cipherKey = assertUnlocked();
  const envelope = encryptPayload(plainPayload, cipherKey);
  const now = Date.now();
  const id = `${type}-${now}-${Math.random().toString(36).substring(2, 8)}`;

  const db = getDatabase();
  await db.write(async () => {
    await db.get('vault_items').create((m: any) => {
      m._raw.id = id;
      m.itemType = type;
      m.title = title.trim();
      m.payloadCiphertext = JSON.stringify(envelope);
      m.folder = metadata?.folder?.trim() || null;
      m.icon = metadata?.icon || null;
      m.urlHint = metadata?.urlHint?.trim() || null;
      m.favorite = metadata?.favorite || false;
      m.lastUsedAt = null;
      m.createdAt = now;
      m.updatedAt = now;
      m.isPendingDelete = false;
    });
  });

  Logger.info('VaultItem created', { module: 'VaultService', type, id });

  onVaultItemChanged('INSERT', id, {
    id,
    itemType: type,
    title: title.trim(),
    payload: plainPayload,
    folder: metadata?.folder?.trim() || null,
    icon: metadata?.icon || null,
    urlHint: metadata?.urlHint?.trim() || null,
    favorite: metadata?.favorite || false,
    lastUsedAt: null,
    createdAt: now,
  }).catch(() => {});

  return id;
}

export async function decryptVaultItem(
  raw: Record<string, unknown>,
): Promise<DecryptedVaultItem | null> {
  try {
    const cipherKey = assertUnlocked();
    const envelope: EncryptedEnvelope = JSON.parse(raw.payloadCiphertext as string);
    const payload = decryptPayload(envelope, cipherKey);

    return {
      id: raw.id as string,
      itemType: raw.itemType as VaultItemType,
      title: raw.title as string,
      folder: (raw.folder as string) || null,
      payload: payload as unknown as VaultPayload,
      favorite: (raw.favorite as boolean) || false,
      icon: (raw.icon as string) || null,
      urlHint: (raw.urlHint as string) || null,
      lastUsedAt: (raw.lastUsedAt as number) || null,
      createdAt: raw.createdAt as number,
      updatedAt: raw.updatedAt as number,
    };
  } catch (err: any) {
    Logger.warn('Failed to decrypt vault item', {
      module: 'VaultService',
      id: raw.id as string,
      error: err.message,
    });
    return null;
  }
}

export async function getVaultItemById(id: string): Promise<DecryptedVaultItem | null> {
  const db = getDatabase();
  try {
    const record = await db.get('vault_items').find(id);
    const raw = recordToPlain(record);
    return decryptVaultItem(raw);
  } catch {
    return null;
  }
}

export async function updateVaultItem(
  id: string,
  updates: {
    title?: string;
    plainPayload?: Record<string, unknown>;
    folder?: string | null;
    icon?: string | null;
    urlHint?: string | null;
    favorite?: boolean;
  },
): Promise<void> {
  const db = getDatabase();
  let itemType: VaultItemType = 'note';
  let plainPayloadForSync: Record<string, unknown> | null = null;

  await db.write(async () => {
    const record = (await db.get('vault_items').find(id)) as any;

    if (updates.title !== undefined) {
      record.title = updates.title.trim();
    }

    if (updates.plainPayload !== undefined) {
      itemType = record.itemType || record._raw?.item_type || 'note';
      const validation = validatePayload(itemType, updates.plainPayload);
      if (!validation.success) {
        throw new Error(validation.error);
      }
      const cipherKey = assertUnlocked();
      const envelope = encryptPayload(updates.plainPayload, cipherKey);
      record.payloadCiphertext = JSON.stringify(envelope);
      plainPayloadForSync = updates.plainPayload;
    }

    if (updates.folder !== undefined) record.folder = updates.folder?.trim() || null;
    if (updates.icon !== undefined) record.icon = updates.icon;
    if (updates.urlHint !== undefined) record.urlHint = updates.urlHint?.trim() || null;
    if (updates.favorite !== undefined) record.favorite = updates.favorite;

    record.updatedAt = Date.now();
    await record.update(record);
  });

  if (plainPayloadForSync) {
    const raw = recordToPlain(await db.get('vault_items').find(id));
    onVaultItemChanged('UPDATE', id, {
      id,
      itemType,
      title: updates.title || (raw.title as string),
      payload: plainPayloadForSync,
      folder: updates.folder !== undefined ? updates.folder : raw.folder,
      icon: updates.icon !== undefined ? updates.icon : raw.icon,
      urlHint: updates.urlHint !== undefined ? updates.urlHint : raw.urlHint,
      favorite: updates.favorite !== undefined ? updates.favorite : raw.favorite,
      lastUsedAt: raw.lastUsedAt,
      createdAt: raw.createdAt,
    }).catch(() => {});
  } else {
    const raw = recordToPlain(await db.get('vault_items').find(id));
    const decrypted = await decryptVaultItem(raw);
    if (decrypted) {
      onVaultItemChanged('UPDATE', id, {
        id,
        itemType: decrypted.itemType,
        title: decrypted.title,
        payload: decrypted.payload as Record<string, unknown>,
        folder: decrypted.folder,
        icon: decrypted.icon,
        urlHint: decrypted.urlHint,
        favorite: decrypted.favorite,
        lastUsedAt: decrypted.lastUsedAt,
        createdAt: decrypted.createdAt,
      }).catch(() => {});
    }
  }
}

export async function markVaultItemUsed(id: string): Promise<void> {
  const db = getDatabase();
  await db.write(async () => {
    try {
      const record = await db.get('vault_items').find(id);
      await record.update((m: any) => {
        m.lastUsedAt = Date.now();
      });
    } catch {}
  });
}

export async function toggleFavorite(id: string): Promise<void> {
  const db = getDatabase();
  let newFavorite = false;
  await db.write(async () => {
    const record = await db.get('vault_items').find(id);
    newFavorite = !((record as any).favorite ?? false);
    await record.update((m: any) => {
      m.favorite = newFavorite;
    });
  });

  onVaultItemChanged('UPDATE', id, { id, favorite: newFavorite }).catch(() => {});
}

export async function deleteVaultItem(id: string): Promise<void> {
  const db = getDatabase();
  await db.write(async () => {
    const record = await db.get('vault_items').find(id);
    await record.markAsDeleted();
  });

  onVaultItemChanged('DELETE', id, { id }).catch(() => {});
}

export async function queryVaultItems(filters?: {
  type?: VaultItemType;
  search?: string;
}): Promise<VaultItemMetadata[]> {
  const db = getDatabase();
  const records = await db.get('vault_items').query().fetch();

  const items: VaultItemMetadata[] = records
    .filter((r: any) => {
      if (r.isPendingDelete || r._raw?.is_pending_delete) return false;
      if (filters?.type && r.itemType !== filters.type && r._raw?.item_type !== filters.type) return false;
      if (filters?.search) {
        const q = filters.search.toLowerCase();
        const title = (r.title || r._raw?.title || '').toLowerCase();
        const urlHint = (r.urlHint || r._raw?.url_hint || '').toLowerCase();
        const folder = (r.folder || r._raw?.folder || '').toLowerCase();
        return title.includes(q) || urlHint.includes(q) || folder.includes(q);
      }
      return true;
    })
    .map((r: any) => ({
      id: r.id,
      itemType: r.itemType ?? r._raw?.item_type ?? 'note',
      title: r.title ?? r._raw?.title ?? '',
      folder: r.folder ?? r._raw?.folder ?? null,
      icon: r.icon ?? r._raw?.icon ?? null,
      urlHint: r.urlHint ?? r._raw?.url_hint ?? null,
      favorite: r.favorite ?? r._raw?.favorite ?? false,
      lastUsedAt: r.lastUsedAt ?? r._raw?.last_used_at ?? null,
      createdAt: r.createdAt ?? r._raw?.created_at ?? Date.now(),
    }));

  items.sort((a, b) => b.createdAt - a.createdAt);
  return items;
}

function recordToPlain(record: any): Record<string, unknown> {
  const raw = record._raw || {};
  return {
    id: record.id,
    itemType: record.itemType ?? raw.item_type,
    title: record.title ?? raw.title,
    folder: record.folder ?? raw.folder ?? null,
    payloadCiphertext: record.payloadCiphertext ?? raw.payload_ciphertext,
    favorite: record.favorite ?? raw.favorite ?? false,
    icon: record.icon ?? raw.icon ?? null,
    urlHint: record.urlHint ?? raw.url_hint ?? null,
    lastUsedAt: record.lastUsedAt ?? raw.last_used_at ?? null,
    createdAt: record.createdAt ?? raw.created_at ?? 0,
    updatedAt: record.updatedAt ?? raw.updated_at ?? 0,
  };
}

export { encryptPayload, decryptPayload, validatePayload };
export type { VaultItemType };
