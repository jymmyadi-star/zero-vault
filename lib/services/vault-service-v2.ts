import { eq, and } from 'drizzle-orm';
import { getV2Database, type V2Database } from '../db/database-v2';
import { vaultItems } from '../db/schema-v2';
import { encryptPayload, decryptPayload, type EncryptedEnvelope } from '../crypto/crypto-utils';
import { Logger } from '../logger';

export interface V2VaultItem {
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

export async function createV2VaultItem(
  itemType: V2VaultItem['itemType'],
  title: string,
  payload: Record<string, unknown>,
  cipherKey: Uint8Array,
  opts?: { folder?: string; favorite?: boolean; icon?: string; urlHint?: string },
): Promise<V2VaultItem> {
  const db = getV2Database();
  const id = `vi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const envelope = encryptPayload(payload, cipherKey);

  const row = {
    id,
    itemType,
    title,
    folder: opts?.folder ?? null,
    payloadCiphertext: JSON.stringify(envelope),
    favorite: opts?.favorite ?? false,
    icon: opts?.icon ?? null,
    urlHint: opts?.urlHint ?? null,
    lastUsedAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    revision: null,
    isPendingDelete: false,
  };

  await db.insert(vaultItems).values(row);
  Logger.info('[VaultService V2] VaultItem created', { module: 'VaultServiceV2', id });

  return {
    id,
    itemType,
    title,
    folder: row.folder,
    payload,
    favorite: row.favorite,
    icon: row.icon,
    urlHint: row.urlHint,
    lastUsedAt: null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getV2VaultItems(cipherKey: Uint8Array): Promise<V2VaultItem[]> {
  const db = getV2Database();
  const rows = await db.select().from(vaultItems).where(eq(vaultItems.isPendingDelete, false));
  return rows.map((r: typeof vaultItems.$inferSelect) => decryptV2Row(r, cipherKey));
}

export async function getV2VaultItemById(id: string, cipherKey: Uint8Array): Promise<V2VaultItem | null> {
  const db = getV2Database();
  const rows = await db.select().from(vaultItems).where(and(eq(vaultItems.id, id), eq(vaultItems.isPendingDelete, false)));
  if (rows.length === 0) return null;
  return decryptV2Row(rows[0]!, cipherKey);
}

export async function updateV2VaultItem(
  id: string,
  updates: Partial<Pick<V2VaultItem, 'title' | 'folder' | 'payload' | 'favorite' | 'icon' | 'urlHint'>>,
  cipherKey: Uint8Array,
): Promise<V2VaultItem | null> {
  const db = getV2Database();
  const existing = await getV2VaultItemById(id, cipherKey);
  if (!existing) return null;

  const newPayload = updates.payload ?? existing.payload;
  const envelope = encryptPayload(newPayload, cipherKey);

  const set: Record<string, unknown> = {
    payloadCiphertext: JSON.stringify(envelope),
    updatedAt: Date.now(),
  };
  if (updates.title !== undefined) set.title = updates.title;
  if (updates.folder !== undefined) set.folder = updates.folder;
  if (updates.favorite !== undefined) set.favorite = updates.favorite;
  if (updates.icon !== undefined) set.icon = updates.icon;
  if (updates.urlHint !== undefined) set.urlHint = updates.urlHint;

  await db.update(vaultItems).set(set).where(eq(vaultItems.id, id));
  Logger.info('[VaultService V2] VaultItem updated', { module: 'VaultServiceV2', id });

  return { ...existing, ...updates, updatedAt: set.updatedAt as number };
}

export async function deleteV2VaultItem(id: string): Promise<void> {
  const db = getV2Database();
  await db.update(vaultItems).set({ isPendingDelete: true, updatedAt: Date.now() }).where(eq(vaultItems.id, id));
  Logger.info('[VaultService V2] VaultItem marked deleted', { module: 'VaultServiceV2', id });
}

function decryptV2Row(row: typeof vaultItems.$inferSelect, cipherKey: Uint8Array): V2VaultItem {
  const envelope: EncryptedEnvelope = JSON.parse(row.payloadCiphertext);
  const payload = decryptPayload(envelope, cipherKey);
  return {
    id: row.id,
    itemType: row.itemType as V2VaultItem['itemType'],
    title: row.title,
    folder: row.folder,
    payload,
    favorite: row.favorite ?? false,
    icon: row.icon,
    urlHint: row.urlHint,
    lastUsedAt: row.lastUsedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
