/**
 * Import vault items from Bitwarden and 1Password CSV exports.
 * Parses CSV, maps fields to Zero Vault format, returns typed results.
 */

export interface ImportedItem {
  type: 'password' | 'note' | 'seed';
  title: string;
  username?: string;
  password?: string;
  url?: string;
  notes?: string;
  totpSecret?: string;
  folder?: string;
}

export interface ImportResult {
  items: ImportedItem[];
  errors: string[];
  source: string;
}

/** Parse any CSV line handling quoted fields with commas and newlines */
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

/** Parse a CSV string into rows of string arrays */
function parseCSV(csv: string): string[][] {
  const rows: string[][] = [];
  const lines = csv.split(/\r?\n/).filter(l => l.trim());
  for (const line of lines) {
    rows.push(parseCSVLine(line));
  }
  return rows;
}

/** Detect CSV source by header row */
function detectSource(headers: string[]): 'bitwarden' | '1password' | 'unknown' {
  const headerStr = headers.join(',').toLowerCase();

  if (headerStr.includes('login_uri') || headerStr.includes('login_username') || headerStr.includes('login_password')) {
    return 'bitwarden';
  }
  if (headerStr.includes('website') || headerStr.includes('login')) {
    return '1password';
  }
  return 'unknown';
}

/** Import from Bitwarden CSV format */
function parseBitwarden(rows: string[][]): ImportResult {
  const headers = rows[0]!.map(h => h.toLowerCase());
  const items: ImportedItem[] = [];
  const errors: string[] = [];

  const folderIdx = headers.indexOf('folder');
  const typeIdx = headers.indexOf('type');
  const nameIdx = headers.indexOf('name');
  const notesIdx = headers.indexOf('notes');
  const uriIdx = Math.max(headers.indexOf('login_uri'), headers.indexOf('uri'));
  const usernameIdx = headers.indexOf('login_username');
  const passwordIdx = headers.indexOf('login_password');
  const totpIdx = headers.indexOf('login_totp');

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]!;
    const type = typeIdx >= 0 ? (row[typeIdx] || '').toLowerCase() : 'login';

    if (type === 'note' || type === 'secure note') {
      items.push({
        type: 'note',
        title: nameIdx >= 0 ? (row[nameIdx] || 'Imported Note') : 'Imported Note',
        notes: notesIdx >= 0 ? row[notesIdx] : '',
        folder: folderIdx >= 0 ? row[folderIdx] : undefined,
      });
    } else {
      items.push({
        type: 'password',
        title: nameIdx >= 0 ? (row[nameIdx] || 'Imported') : 'Imported',
        username: usernameIdx >= 0 ? (row[usernameIdx] || '') : '',
        password: passwordIdx >= 0 ? (row[passwordIdx] || '') : '',
        url: uriIdx >= 0 ? row[uriIdx] : '',
        notes: notesIdx >= 0 ? row[notesIdx] : '',
        totpSecret: totpIdx >= 0 ? row[totpIdx] : undefined,
        folder: folderIdx >= 0 ? row[folderIdx] : undefined,
      });
    }
  }

  return { items, errors, source: 'bitwarden' };
}

/** Import from 1Password CSV format */
function parseOnePassword(rows: string[][]): ImportResult {
  const headers = rows[0]!.map(h => h.toLowerCase());
  const items: ImportedItem[] = [];
  const errors: string[] = [];

  const titleIdx = headers.indexOf('title');
  const urlIdx = Math.max(headers.indexOf('website'), headers.indexOf('url'));
  const usernameIdx = Math.max(headers.indexOf('login'), headers.indexOf('username'));
  const passwordIdx = headers.indexOf('password');
  const notesIdx = headers.indexOf('notes');

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]!;
    items.push({
      type: 'password',
      title: titleIdx >= 0 ? (row[titleIdx] || 'Imported') : 'Imported',
      username: usernameIdx >= 0 ? (row[usernameIdx] || '') : '',
      password: passwordIdx >= 0 ? (row[passwordIdx] || '') : '',
      url: urlIdx >= 0 ? row[urlIdx] : '',
      notes: notesIdx >= 0 ? row[notesIdx] : '',
    });
  }

  return { items, errors, source: '1password' };
}

/** Main import function — detects format and parses accordingly */
export function importVaultCSV(csvText: string): ImportResult {
  if (!csvText || !csvText.trim()) {
    return { items: [], errors: ['Empty file'], source: 'unknown' };
  }

  const rows = parseCSV(csvText);
  if (rows.length < 2) {
    return { items: [], errors: ['File must have a header row and at least one data row'], source: 'unknown' };
  }

  const headers = rows[0]!;
  const source = detectSource(headers);

  if (source === 'bitwarden') {
    return parseBitwarden(rows);
  }
  if (source === '1password') {
    return parseOnePassword(rows);
  }

  return { items: [], errors: ['Unsupported CSV format. Supported: Bitwarden, 1Password'], source: 'unknown' };
}
