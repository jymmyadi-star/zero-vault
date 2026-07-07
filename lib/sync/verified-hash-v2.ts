import { eq } from 'drizzle-orm';
import { getV2Database } from '../db/database-provider-v2';
import { syncMeta } from '../db/schema-v2';
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
    const db = getV2Database();
    const rows = await db.select().from(syncMeta).where(eq(syncMeta.key, HASH_KEY));
    return rows[0]?.value ?? null;
  } catch {
    return null;
  }
}

export async function writeStoredHash(hash: string): Promise<void> {
  try {
    const db = getV2Database();
    const existing = await db.select().from(syncMeta).where(eq(syncMeta.key, HASH_KEY));
    if (existing.length > 0) {
      await db.update(syncMeta).set({ value: hash }).where(eq(syncMeta.key, HASH_KEY));
    } else {
      await db.insert(syncMeta).values({ id: HASH_KEY, key: HASH_KEY, value: hash });
    }
  } catch (err: any) {
    Logger.warn('[Sync] Failed to persist verified hash', { module: 'HashSeal', error: err.message });
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
