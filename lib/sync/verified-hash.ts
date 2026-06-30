import { getDatabase } from '../db';
import { Logger } from '../logger';
import { hexToBytes, bytesToHex, encryptPayload, decryptPayload } from '../crypto/crypto-utils';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';

const HASH_KEY = 'zerovault_verified_hash';
const SEAL_DOMAIN = 'zerovault-hash-seal-key-v1';

function deriveSealKey(signKey: Uint8Array): Uint8Array {
  const info = new TextEncoder().encode(SEAL_DOMAIN);
  const salt = sha256(new TextEncoder().encode('zerovault-seal-salt-v2'));
  return hkdf(sha256, signKey, salt, info, 32);
}

export async function readStoredHash(): Promise<string | null> {
  try {
    const db = getDatabase();
    const meta = await db.get('sync_meta').find(HASH_KEY);
    return (meta as any).value as string;
  } catch {
    return null;
  }
}

export async function writeStoredHash(hash: string): Promise<void> {
  try {
    const db = getDatabase();
    const existing = await db.get('sync_meta').find(HASH_KEY);
    await existing.update((m: any) => { m.value = hash; });
  } catch {
    try {
      const db = getDatabase();
      await db.get('sync_meta').create((m: any) => {
        m._raw.id = HASH_KEY;
        m.key = HASH_KEY;
        m.value = hash;
      });
    } catch (err: any) {
      Logger.warn('[Sync] Failed to persist verified hash', { module: 'HashSeal', error: err.message });
    }
  }
}

export function sealVerifiedHash(hash: string, signKey: Uint8Array): string {
  const sealKey = deriveSealKey(signKey);
  try {
    const envelope = encryptPayload({ hash }, sealKey, { context: 'zerovault-hash-seal-v2' });
    return JSON.stringify(envelope);
  } finally {
    sealKey.fill(0);
  }
}

export function unsealVerifiedHash(sealedHash: string | null, signKey: Uint8Array): string | null {
  if (!sealedHash) return null;
  const sealKey = deriveSealKey(signKey);
  try {
    const envelope = JSON.parse(sealedHash);
    const data = decryptPayload(envelope, sealKey);
    return (data as { hash: string }).hash;
  } catch {
    return null;
  } finally {
    sealKey.fill(0);
  }
}
