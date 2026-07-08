/**
 * vault-export.ts — Export vault to standard formats
 *
 * Supports:
 *   - Bitwarden JSON (importable into Bitwarden, Vaultwarden, compatible managers)
 *   - Generic CSV (name,url,username,password,notes,totp,folder)
 *
 * Zero Vault only exports decrypted data in-memory.
 * The export string is never written to disk by this module.
 * The caller is responsible for sharing/saving securely.
 */

import { getV2VaultItems, type V2VaultItem } from './services/vault-service-v2';
import { useVaultStore } from './store/vault-store';
import { randomBytes, encryptPayload, type EncryptedEnvelope } from './crypto/crypto-utils';

export interface ExportOptions {
  format: 'bitwarden-json' | 'csv';
  password?: string;
}

export interface ExportResult {
  data: string;
  itemCount: number;
  format: string;
}

// ─── Bitwarden JSON format ───

interface BitwardenItem {
  id: string;
  type: number; // 1=login, 2=note
  name: string;
  notes: string | null;
  favorite: boolean;
  folder: string | null;
  login?: {
    username: string;
    password: string;
    uris: Array<{ uri: string; match: null }>;
    totp: string | null;
  };
  fields?: Array<{ name: string; value: string; type: number }>;
}

function tobitwardenItem(item: V2VaultItem): BitwardenItem | null {
  if (!item) return null;

  const payload = item.payload as Record<string, unknown>;
  const isNote = item.itemType === 'note';
  const isSeed = item.itemType === 'seed' || item.itemType === 'seed_phrase' as any;

  const base: BitwardenItem = {
    id: item.id,
    type: isNote || isSeed ? 2 : 1,
    name: item.title,
    notes: isNote
      ? ((payload.content as string) || (payload.text as string) || null)
      : isSeed
      ? ((payload.phrase as string) || null)
      : ((payload.notes as string) || null),
    favorite: item.favorite,
    folder: item.folder || null,
  };

  if (!isNote && !isSeed) {
    base.login = {
      username: (payload.username as string) || '',
      password: (payload.password as string) || '',
      uris: item.urlHint ? [{ uri: item.urlHint, match: null }] : [],
      totp: (payload.totpSecret as string) || null,
    };
  }

  if (isSeed) {
    base.fields = [{ name: 'Seed Phrase', value: (payload.phrase as string) || '', type: 1 }];
  }

  return base;
}

// ─── CSV format ───

function escapeCSV(val: unknown): string {
  const s = String(val ?? '').replace(/"/g, '""');
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
}

function toCSVRow(item: V2VaultItem): string | null {
  if (!item) return null;
  const payload = item.payload as Record<string, unknown>;
  const fields = [
    item.title,
    item.urlHint || (payload.url as string) || '',
    (payload.username as string) || '',
    (payload.password as string) || '',
    (payload.notes as string) || (payload.content as string) || (payload.phrase as string) || '',
    (payload.totpSecret as string) || '',
    item.folder || '',
    item.itemType,
  ];
  return fields.map(escapeCSV).join(',');
}

// ─── Main export function ───

export async function exportVault(options: ExportOptions): Promise<ExportResult> {
  const cipherKey = useVaultStore.getState().cipherKey;
  if (!cipherKey) throw new Error('Vault is locked. Cannot export data.');

  const cipherKeyCopy = cipherKey.copy();
  const decryptedItems = await getV2VaultItems(cipherKeyCopy);
  cipherKeyCopy.fill(0);

  const items = decryptedItems.filter(Boolean);

  if (options.format === 'bitwarden-json') {
    const bitwardenItems = items.map(tobitwardenItem).filter(Boolean);
    const exportData = {
      encrypted: !!options.password,
      folders: [],
      items: bitwardenItems,
      _zerovault_export: {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        itemCount: bitwardenItems.length,
      },
    };
    let data: string;
    if (options.password) {
      const pwBytes = new TextEncoder().encode(options.password);
      const salt = randomBytes(32);
      const { deriveWithPBKDF2Async } = await import('./crypto/crypto-utils');
      const key = await deriveWithPBKDF2Async(options.password, salt, 600000, 32);
      const envelope = encryptPayload(exportData as unknown as Record<string, unknown>, key, { export_password_protected: true });
      data = JSON.stringify({ salt: Buffer.from(salt).toString('hex'), envelope });
      key.fill(0);
      pwBytes.fill(0);
    } else {
      data = JSON.stringify(exportData, null, 2);
    }
    return {
      data,
      itemCount: bitwardenItems.length,
      format: 'Bitwarden JSON',
    };
  }

  // CSV
  const header = 'name,url,username,password,notes,totp,folder,type';
  const rows = items.map(toCSVRow).filter(Boolean) as string[];
  return {
    data: [header, ...rows].join('\n'),
    itemCount: rows.length,
    format: 'CSV',
  };
}
