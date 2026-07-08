import { createVaultItem } from './vault-service';
import type { VaultItemType } from '../validation/vault-schemas';

export interface ImportPreviewItem {
  title: string;
  username?: string;
  password?: string;
  url?: string;
  notes?: string;
  totpSecret?: string;
  folder?: string;
  itemType: VaultItemType;
  errors: string[];
}

export interface ImportSummary {
  total: number;
  valid: number;
  invalid: number;
  items: ImportPreviewItem[];
}

const CSV_HEADER_ALIASES: Record<string, { field: keyof ImportPreviewItem; required: boolean }> = {
  title: { field: 'title', required: true },
  name: { field: 'title', required: true },
  service: { field: 'title', required: true },
  grouping: { field: 'title', required: true },     // LastPass
  username: { field: 'username', required: false },
  login: { field: 'username', required: false },
  login_username: { field: 'username', required: false }, // Bitwarden CLI export
  user: { field: 'username', required: false },
  email: { field: 'username', required: false },
  password: { field: 'password', required: false },
  secret: { field: 'password', required: false },
  pass: { field: 'password', required: false },
  login_password: { field: 'password', required: false }, // Bitwarden CLI export
  url: { field: 'url', required: false },
  website: { field: 'url', required: false },
  uri: { field: 'url', required: false },
  login_uri: { field: 'url', required: false },          // Bitwarden CLI export
  login_url: { field: 'url', required: false },          // LastPass
  notes: { field: 'notes', required: false },
  note: { field: 'notes', required: false },
  extra: { field: 'notes', required: false },            // LastPass
  totp: { field: 'totpSecret', required: false },
  totp_secret: { field: 'totpSecret', required: false },
  otpauth: { field: 'totpSecret', required: false },
  folder: { field: 'folder', required: false },
  category: { field: 'folder', required: false },
  group: { field: 'folder', required: false },
  fav: { field: 'folder', required: false },             // LastPass (ignored but mapped)
};

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function mapCSVFields(headers: string[], row: string[]): ImportPreviewItem {
  const mapped: Record<string, string> = {};
  for (let i = 0; i < headers.length && i < row.length; i++) {
    mapped[headers[i]!] = row[i]!;
  }

  const item: ImportPreviewItem = {
    title: '',
    itemType: 'password',
    errors: [],
  };

  for (const [header, value] of Object.entries(mapped)) {
    if (!value) continue;
    const normalized = header.toLowerCase().trim();
    const alias = CSV_HEADER_ALIASES[normalized];
    if (alias) {
      const existing = item[alias.field];
      if (existing) {
        (item as any)[alias.field] = existing;
      } else {
        (item as any)[alias.field] = value;
      }
    } else if (normalized === 'type') {
      const t = value.toLowerCase();
      if (t === 'note' || t === 'secure_note') item.itemType = 'note';
      if (t === 'seed' || t === 'seed_phrase' || t === 'recovery') item.itemType = 'seed_phrase';
    }
  }

  if (!item.title) {
    item.errors.push('Missing title');
  }

  return item;
}

function parseCSV(csv: string): ImportPreviewItem[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]!);
  const items: ImportPreviewItem[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]!);
    if (row.length === 0) continue;
    items.push(mapCSVFields(headers, row));
  }

  return items;
}

function parseBitwardenJSON(data: string): ImportPreviewItem[] {
  try {
    const parsed = JSON.parse(data);
    const rawItems = parsed?.items ?? parsed;
    const items: ImportPreviewItem[] = [];

    for (const entry of rawItems) {
      const title = entry.name || entry.title || 'Imported Item';
      const login = entry.login || entry;
      const item: ImportPreviewItem = {
        title,
        username: login.username || entry.username || '',
        password: login.password || entry.password || '',
        url: login.uris?.[0]?.uri || entry.url || entry.uri || '',
        notes: entry.notes || '',
        totpSecret: login.totp || entry.totp || '',
        folder: entry.folder || entry.collectionId || '',
        itemType: entry.type === 2 ? 'note' : 'password',
        errors: [],
      };

      if (!item.title) {
        item.errors.push('Missing title');
      }

      items.push(item);
    }
    return items;
  } catch {
    return [];
  }
}

function parseOnePasswordCSV(data: string): ImportPreviewItem[] {
  const lines = data.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]!);
  const items: ImportPreviewItem[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]!);
    const mapped: Record<string, string> = {};
    for (let j = 0; j < headers.length && j < row.length; j++) {
      mapped[headers[j]!.toLowerCase()] = row[j]!;
    }

    const item: ImportPreviewItem = {
      title: mapped.title || mapped.name || '',
      username: mapped.username || '',
      password: mapped.password || '',
      url: mapped.url || mapped.website || '',
      notes: mapped.notes || '',
      totpSecret: mapped.otpauth || mapped.totp || '',
      folder: mapped.folder || mapped.vault || '',
      itemType: 'password',
      errors: [],
    };

    if (!item.title) {
      item.errors.push('Missing title');
    }

    items.push(item);
  }
  return items;
}

function parseChromeCSV(data: string): ImportPreviewItem[] {
  const lines = data.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]!);
  const items: ImportPreviewItem[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]!);
    const mapped: Record<string, string> = {};
    for (let j = 0; j < headers.length && j < row.length; j++) {
      mapped[headers[j]!.toLowerCase()] = row[j]!;
    }

    const item: ImportPreviewItem = {
      title: mapped.name || mapped.url || 'Imported Item',
      username: mapped.username || '',
      password: mapped.password || '',
      url: mapped.url || '',
      notes: '',
      totpSecret: '',
      folder: '',
      itemType: 'password',
      errors: [],
    };

    if (!item.username && !item.password) {
      item.errors.push('No credentials found');
    }

    items.push(item);
  }
  return items;
}

export type ImportFormat = 'auto' | 'csv' | 'bitwarden-json' | 'onepassword-csv' | 'chrome-csv';

export function parseImport(data: string, format: ImportFormat = 'auto'): ImportSummary {
  let items: ImportPreviewItem[] = [];

  const trimmed = data.trim();

  if (format === 'bitwarden-json' || (format === 'auto' && trimmed.startsWith('{'))) {
    items = parseBitwardenJSON(trimmed);
  }

  if (items.length === 0 && (format === 'onepassword-csv' || format === 'auto')) {
    const firstLine = trimmed.split('\n')[0]?.toLowerCase() || '';
    if (firstLine.includes('title') && (firstLine.includes('url') || firstLine.includes('website'))) {
      items = parseOnePasswordCSV(trimmed);
    }
  }

  if (items.length === 0 && (format === 'chrome-csv' || format === 'auto')) {
    const firstLine = trimmed.split('\n')[0]?.toLowerCase() || '';
    // Chrome: name,url,username,password  |  Firefox: url,username,password,http_realm,form_action_origin,...
    if (firstLine.includes('url') && firstLine.includes('username') && firstLine.includes('password')) {
      items = parseChromeCSV(trimmed);
    }
  }

  if (items.length === 0) {
    items = parseCSV(trimmed);
  }

  const valid = items.filter((i) => i.errors.length === 0).length;
  const invalid = items.length - valid;

  return { total: items.length, valid, invalid, items };
}

export async function executeImport(
  items: ImportPreviewItem[],
  onProgress?: (current: number, total: number, title: string) => void,
): Promise<{ imported: number; failed: number }> {
  let imported = 0;
  let failed = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item || item.errors.length > 0) {
      failed++;
      continue;
    }

    try {
      onProgress?.(i + 1, items.length, item.title);

      const payload: Record<string, unknown> = {};
      if (item.username) payload.username = item.username;
      if (item.password) payload.password = item.password;
      if (item.url) payload.url = item.url;
      if (item.notes) payload.notes = item.notes;
      if (item.totpSecret) payload.totpSecret = item.totpSecret.replace(/\s/g, '');

      if (item.itemType === 'password') {
        if (payload.password || payload.username || payload.url) {
          payload.password = payload.password || '';
        }
      }

      await createVaultItem(item.itemType, item.title || 'Imported Item', payload as any, {
        folder: item.folder || undefined,
        urlHint: item.url || undefined,
      });

      imported++;
    } catch {
      failed++;
    }
  }

  return { imported, failed };
}
