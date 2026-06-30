/**
 * key-rotation.ts — Cryptographic key rotation for Zero Vault
 *
 * When a user suspects their SignKey or CipherKey may be compromised,
 * they can rotate keys. This:
 *   1. Derives a new set of keys from a new random root key
 *   2. Re-wraps all keys with the existing PIN (so user doesn't need to change PIN)
 *   3. Re-encrypts all vault items with the new CipherKey
 *   4. Increments key_epoch_id in sync metadata so server knows keys changed
 *   5. Zeroes all old key material from memory
 *
 * This does NOT change the user's PIN. It changes the underlying crypto keys.
 */

import * as SecureStore from 'expo-secure-store';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import {
  randomBytes,
  wrapKey,
  unwrapKey,
  serializeWrappedKey,
  deserializeWrappedKey,
  encryptPayload,
  decryptPayload,
  deriveWithArgon2,
  hexToBytes,
  bytesToHex,
  type EncryptedEnvelope,
} from './crypto/crypto-utils';
import { SecureBuffer } from './crypto/secure-buffer';
import { getDatabase } from './db';
import { useVaultStore } from './store/vault-store';
import { Logger } from './logger';

const SECURESTORE_KEYS = {
  DEVICE_SALT: 'zerovault_device_salt',
  WRAPPED_VAULT_KEY: 'zerovault_wrapped_vault_key',
  WRAPPED_CIPHER_KEY: 'zerovault_wrapped_cipher_key',
  WRAPPED_SIGN_KEY: 'zerovault_wrapped_sign_key',
  KEY_EPOCH: 'zerovault_key_epoch',
} as const;

function deriveWrapKey(masterKey: Uint8Array): SecureBuffer {
  const info = new TextEncoder().encode('zerovault-wrap-v1');
  const raw = hkdf(sha256, masterKey, new Uint8Array(0), info, 32);
  return SecureBuffer.from(raw);
}

export interface RotationResult {
  newEpochId: number;
  reEncryptedCount: number;
}

/**
 * Rotate all cryptographic keys.
 *
 * @param currentPin - The user's current Master PIN (needed to re-derive the wrapping key)
 * @param onProgress - Optional callback: (current, total) => void
 */
export async function rotateKeys(
  currentPin: string,
  onProgress?: (current: number, total: number) => void,
): Promise<RotationResult> {
  Logger.info('[KeyRotation] Starting key rotation', { module: 'KeyRotation' });

  // 1. Verify PIN and get current wrapping key
  const saltHex = await SecureStore.getItemAsync(SECURESTORE_KEYS.DEVICE_SALT);
  if (!saltHex) throw new Error('VAULT_NOT_SETUP');

  const deviceSalt = hexToBytes(saltHex);
  const masterKey = await deriveWithArgon2(currentPin, deviceSalt);
  const wrappingKey = deriveWrapKey(masterKey);
  masterKey.fill(0);

  // 2. Unwrap current cipher key (needed to decrypt existing items)
  const wrappedCipherStr = await SecureStore.getItemAsync(SECURESTORE_KEYS.WRAPPED_CIPHER_KEY);
  if (!wrappedCipherStr) {
    wrappingKey.dispose();
    throw new Error('CIPHER_KEY_NOT_FOUND');
  }
  const oldCipherKey = unwrapKey(deserializeWrappedKey(wrappedCipherStr), wrappingKey.copy());

  // 3. Generate new random keys
  const newCipherKeyRaw = randomBytes(32);
  const newSignKeyRaw = randomBytes(32);
  const newVaultKeyRaw = randomBytes(32);

  // 4. Re-wrap new keys with the SAME wrapping key (PIN unchanged)
  const newWrappedVault = wrapKey(newVaultKeyRaw, wrappingKey.copy());
  const newWrappedCipher = wrapKey(newCipherKeyRaw, wrappingKey.copy());
  const newWrappedSign = wrapKey(newSignKeyRaw, wrappingKey.copy());
  wrappingKey.dispose();

  // 5. Decrypt all vault items with old key, then re-encrypt with new key (in memory)
  const db = getDatabase();
  const records = await db.get('vault_items').query().fetch();
  const activeRecords = records.filter((r: any) => !(r.isPendingDelete || r._raw?.is_pending_delete));
  const total = activeRecords.length;

  // Collect all re-encrypted payloads before touching the DB
  const reEncrypted: Array<{ record: any; newPayloadCiphertext: string }> = [];

  for (const record of activeRecords) {
    const raw = (record as any)._raw || {};
    const ciphertextStr = (record as any).payloadCiphertext || raw.payload_ciphertext;
    if (!ciphertextStr) continue;

    const envelope: EncryptedEnvelope = JSON.parse(ciphertextStr);
    const plaintext = decryptPayload(envelope, oldCipherKey);
    const newEnvelope = encryptPayload(plaintext, newCipherKeyRaw);

    reEncrypted.push({ record, newPayloadCiphertext: JSON.stringify(newEnvelope) });
  }

  // 6. Single atomic DB transaction — all-or-nothing
  await db.write(async () => {
    for (const { record, newPayloadCiphertext } of reEncrypted) {
      await record.update((m: any) => {
        m.payloadCiphertext = newPayloadCiphertext;
        m.updatedAt = Date.now();
      });
    }
  });

  const reEncryptedCount = reEncrypted.length;
  for (let i = 0; i < reEncryptedCount; i++) {
    onProgress?.(i + 1, total);
  }

  // 7. Store new wrapped keys in SecureStore
  await SecureStore.setItemAsync(SECURESTORE_KEYS.WRAPPED_VAULT_KEY, serializeWrappedKey(newWrappedVault));
  await SecureStore.setItemAsync(SECURESTORE_KEYS.WRAPPED_CIPHER_KEY, serializeWrappedKey(newWrappedCipher));
  await SecureStore.setItemAsync(SECURESTORE_KEYS.WRAPPED_SIGN_KEY, serializeWrappedKey(newWrappedSign));

  // 8. Increment epoch
  const currentEpochStr = await SecureStore.getItemAsync(SECURESTORE_KEYS.KEY_EPOCH);
  const currentEpoch = currentEpochStr ? parseInt(currentEpochStr, 10) : 0;
  const newEpochId = (isNaN(currentEpoch) ? 0 : currentEpoch) + 1;
  await SecureStore.setItemAsync(SECURESTORE_KEYS.KEY_EPOCH, newEpochId.toString());

  // 9. Update vault store with new keys (so app keeps working without re-unlock)
  const { unlock } = useVaultStore.getState();
  unlock({
    vaultKey: SecureBuffer.from(newVaultKeyRaw),
    cipherKey: SecureBuffer.from(newCipherKeyRaw),
    signKey: SecureBuffer.from(newSignKeyRaw),
  });

  // 10. Zero old key material
  oldCipherKey.fill(0);
  newCipherKeyRaw.fill(0);
  newSignKeyRaw.fill(0);
  newVaultKeyRaw.fill(0);

  Logger.info('[KeyRotation] Key rotation complete', {
    module: 'KeyRotation',
    newEpochId,
    reEncryptedCount,
  });

  return { newEpochId, reEncryptedCount };
}

/**
 * Get current key epoch ID.
 */
export async function getKeyEpoch(): Promise<number> {
  try {
    const val = await SecureStore.getItemAsync(SECURESTORE_KEYS.KEY_EPOCH);
    return val ? parseInt(val, 10) : 0;
  } catch {
    return 0;
  }
}
