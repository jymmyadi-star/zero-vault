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

import { getDatabase } from '../db';
import { decryptVaultItem } from '../services/vault-service';

export interface ExportOptions {
  format: 'bitwarden-json' | 'csv';
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

function tobitwardenItem(item: Awaited<ReturnType<typeof decryptVaultItem>>): BitwardenItem | null {
  if (!item) return null;

  const payload = item.payload as Record<string, unknown>;
  const isNote = item.itemType === 'note';
  const isSeed = item.itemType === 'seed_phrase';

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

function toCSVRow(item: Awaited<ReturnType<typeof decryptVaultItem>>): string | null {
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
  const db = getDatabase();
  const records = await db.get('vault_items').query().fetch();

  const decryptedItems = await Promise.all(
    records
      .filter((r: any) => !(r.isPendingDelete || r._raw?.is_pending_delete))
      .map((r: any) => {
        const raw = {
          id: r.id,
          itemType: r.itemType ?? r._raw?.item_type,
          title: r.title ?? r._raw?.title,
          folder: r.folder ?? r._raw?.folder ?? null,
          payloadCiphertext: r.payloadCiphertext ?? r._raw?.payload_ciphertext,
          favorite: r.favorite ?? r._raw?.favorite ?? false,
          icon: r.icon ?? r._raw?.icon ?? null,
          urlHint: r.urlHint ?? r._raw?.url_hint ?? null,
          lastUsedAt: r.lastUsedAt ?? r._raw?.last_used_at ?? null,
          createdAt: r.createdAt ?? r._raw?.created_at ?? 0,
          updatedAt: r.updatedAt ?? r._raw?.updated_at ?? 0,
        };
        return decryptVaultItem(raw);
      }),
  );

  const items = decryptedItems.filter(Boolean);

  if (options.format === 'bitwarden-json') {
    const bitwardenItems = items.map(tobitwardenItem).filter(Boolean);
    const exportData = {
      encrypted: false,
      folders: [],
      items: bitwardenItems,
      _zerovault_export: {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        itemCount: bitwardenItems.length,
      },
    };
    return {
      data: JSON.stringify(exportData, null, 2),
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
