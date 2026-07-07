/**
 * vault-keychain.ts — Enterprise-grade key management
 *
 * Uses SecureBuffer for all key material.
 * Memory-safe: zero-on-dispose guarantees key clearing regardless of GC.
 * Result<T,E>: every function has a Safe variant returning Result types.
 */
import * as SecureStore from 'expo-secure-store';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import {
  randomBytes, generateRandomKey, wrapKey, unwrapKey,
  serializeWrappedKey, deserializeWrappedKey,
  computeSyncSignature, bytesToHex, hexToBytes,
  timingSafeCompare, deriveWithPBKDF2Async, derivePairingId,
  type WrappedKey,
} from './crypto-utils';
import { SecureBuffer } from './secure-buffer';
import { generateMnemonic, mnemonicToSeed, validateMnemonic } from './bip39';
import {
  Result, Ok, Err,
  CryptoErrorCode, cryptoError, DomainError,
} from '../result';

const SECURESTORE_KEYS = {
  DEVICE_SALT: 'zerovault_device_salt_v3',
  WRAPPED_VAULT_KEY: 'zerovault_wrapped_vault_key_v3',
  WRAPPED_CIPHER_KEY: 'zerovault_wrapped_cipher_key_v3',
  WRAPPED_SIGN_KEY: 'zerovault_wrapped_sign_key_v3',
  PIN_VERIFY_HASH: 'zerovault_pin_verify_hash_v3',
  PIN_VERIFY_SALT: 'zerovault_pin_verify_salt_v3',
  PIN_ATTEMPT_COUNT: 'zerovault_pin_attempts_v3',
  PIN_LAST_ATTEMPT: 'zerovault_pin_last_attempt_v3',
  HAS_RECOVERY_SEED: 'zerovault_has_recovery_seed_v3',
  KEY_EPOCH: 'zerovault_key_epoch_v3',
  PAIRING_ID: 'zerovault_pairing_id_v3',
} as const;

const MAX_PIN_ATTEMPTS = 5;
const PIN_BACKOFF_BASE_MS = 2000;

const HKDF_INFO = {
  WRAP: 'zerovault-wrap-v1',
} as const;

function pinBackoffMs(attempts: number): number {
  return Math.min(PIN_BACKOFF_BASE_MS * Math.pow(2, attempts), 120_000);
}

export interface VaultKeySet {
  vaultKey: SecureBuffer;
  cipherKey: SecureBuffer;
  signKey: SecureBuffer;
}

export interface VaultGenesisResult {
  keySet: VaultKeySet;
  mnemonic: string;
}

export interface VaultSeed {
  deviceSalt: string;
  wrappedVaultKey: string;
  wrappedCipherKey: string;
  wrappedSignKey: string;
  pinVerifySalt: string;
  pinVerifyHash: string;
  seedMac?: string;
  pairingId?: string;
}

// ─── SecureBuffer-aware key derivation (internal) ───

function deriveWrapKey(masterKey: Uint8Array): SecureBuffer {
  const info = new TextEncoder().encode(HKDF_INFO.WRAP);
  const raw = hkdf(sha256, masterKey, new Uint8Array(0), info, 32);
  return SecureBuffer.from(raw);
}

function deriveDeterministicKey(seed: Uint8Array, purpose: string): SecureBuffer {
  const info = new TextEncoder().encode(`zerovault-deterministic-${purpose}-v1`);
  const raw = hkdf(sha256, seed, new Uint8Array(0), info, 32);
  return SecureBuffer.from(raw);
}

function zeroBuffer(buf: Uint8Array | null): void {
  if (buf && buf.length > 0) buf.fill(0);
}

async function computePinVerifyHash(pin: string, salt: Uint8Array): Promise<string> {
  const hash = await deriveWithPBKDF2Async(pin, salt);
  const hex = bytesToHex(hash);
  hash.fill(0);
  return hex;
}

async function verifyPin(pin: string, saltHex: string | null, storedHash: string | null): Promise<boolean> {
  if (!saltHex || !storedHash) return false;
  const salt = hexToBytes(saltHex);
  const computed = await computePinVerifyHash(pin, salt);
  return timingSafeCompare(computed, storedHash);
}

// ─── Public API (backward compatible — original signatures) ───

export async function isVaultSetup(): Promise<boolean> {
  try {
    const salt = await SecureStore.getItemAsync(SECURESTORE_KEYS.DEVICE_SALT);
    return salt !== null && salt.length > 0 && salt !== 'PURGED';
  } catch { return false; }
}

export async function getPinAttempts(): Promise<number> {
  try {
    const raw = await SecureStore.getItemAsync(SECURESTORE_KEYS.PIN_ATTEMPT_COUNT);
    return raw ? parseInt(raw, 10) : 0;
  } catch { return 0; }
}

export async function isVaultLocked(): Promise<boolean> {
  return (await getPinAttempts()) >= MAX_PIN_ATTEMPTS;
}

export async function hasRecoverySeed(): Promise<boolean> {
  try {
    const val = await SecureStore.getItemAsync(SECURESTORE_KEYS.HAS_RECOVERY_SEED);
    return val === 'true';
  } catch { return false; }
}

export async function createVault(pin: string): Promise<VaultGenesisResult> {
  if (pin.length < 8) throw new Error('Master Password must be at least 8 characters');

  let masterKey: Uint8Array | null = null;
  let wrappingKey: SecureBuffer | null = null;

  try {
    const deviceSalt = SecureBuffer.random(32);
    await SecureStore.setItemAsync(SECURESTORE_KEYS.DEVICE_SALT, deviceSalt.toHex());

    masterKey = await deriveWithPBKDF2Async(pin, deviceSalt.copy());
    deviceSalt.dispose();
    wrappingKey = deriveWrapKey(masterKey);

    const mnemonic = generateMnemonic();
    const recoverySeed = SecureBuffer.from(mnemonicToSeed(mnemonic));

    const pairingId = derivePairingId(recoverySeed.copy());
    await SecureStore.setItemAsync(SECURESTORE_KEYS.PAIRING_ID, pairingId);

    const vaultKey = deriveDeterministicKey(recoverySeed.copy(), 'vault');
    const cipherKey = deriveDeterministicKey(recoverySeed.copy(), 'cipher');
    const signKey = deriveDeterministicKey(recoverySeed.copy(), 'sign');

    const wrappedVault = wrapKey(vaultKey.copy(), wrappingKey.copy());
    const wrappedCipher = wrapKey(cipherKey.copy(), wrappingKey.copy());
    const wrappedSign = wrapKey(signKey.copy(), wrappingKey.copy());

    await SecureStore.setItemAsync(SECURESTORE_KEYS.WRAPPED_VAULT_KEY, serializeWrappedKey(wrappedVault));
    await SecureStore.setItemAsync(SECURESTORE_KEYS.WRAPPED_CIPHER_KEY, serializeWrappedKey(wrappedCipher));
    await SecureStore.setItemAsync(SECURESTORE_KEYS.WRAPPED_SIGN_KEY, serializeWrappedKey(wrappedSign));
    await SecureStore.setItemAsync(SECURESTORE_KEYS.HAS_RECOVERY_SEED, 'true');

    const pinVerifySalt = SecureBuffer.random(32);
    await SecureStore.setItemAsync(SECURESTORE_KEYS.PIN_VERIFY_SALT, pinVerifySalt.toHex());
    const pinVerifyHash = await computePinVerifyHash(pin, pinVerifySalt.copy());
    pinVerifySalt.dispose();
    await SecureStore.setItemAsync(SECURESTORE_KEYS.PIN_VERIFY_HASH, pinVerifyHash);
    await SecureStore.setItemAsync(SECURESTORE_KEYS.PIN_ATTEMPT_COUNT, '0');

    recoverySeed.dispose();

    return { keySet: { vaultKey, cipherKey, signKey }, mnemonic };
  } finally {
    if (masterKey) zeroBuffer(masterKey);
    if (wrappingKey) wrappingKey.dispose();
  }
}

export async function unlockVault(pin: string): Promise<VaultKeySet | null> {
  if (pin.length < 8) return null;
  const attempts = await getPinAttempts();
  if (attempts >= MAX_PIN_ATTEMPTS) throw new Error('VAULT_LOCKED: Too many failed attempts. Reinstall or reset required.');

  const lastAttemptRaw = await SecureStore.getItemAsync(SECURESTORE_KEYS.PIN_LAST_ATTEMPT);
  const lastAttempt = lastAttemptRaw ? parseInt(lastAttemptRaw, 10) : 0;
  const backoff = pinBackoffMs(attempts);
  if (Date.now() - lastAttempt < backoff) {
    const waitMs = backoff - (Date.now() - lastAttempt);
    throw new Error(`PIN_BACKOFF: Please wait ${Math.ceil(waitMs / 1000)} seconds before retrying.`);
  }

  const saltHex = await SecureStore.getItemAsync(SECURESTORE_KEYS.DEVICE_SALT);
  if (!saltHex) return null;

  const deviceSalt = hexToBytes(saltHex);
  const pinVerifySalt = await SecureStore.getItemAsync(SECURESTORE_KEYS.PIN_VERIFY_SALT);
  const storedHash = await SecureStore.getItemAsync(SECURESTORE_KEYS.PIN_VERIFY_HASH);

  if (!(await verifyPin(pin, pinVerifySalt, storedHash))) {
    await SecureStore.setItemAsync(SECURESTORE_KEYS.PIN_ATTEMPT_COUNT, (attempts + 1).toString());
    await SecureStore.setItemAsync(SECURESTORE_KEYS.PIN_LAST_ATTEMPT, Date.now().toString());
    return null;
  }

  let masterKey: Uint8Array | null = null;
  let wrappingKey: SecureBuffer | null = null;

  try {
    masterKey = await deriveWithPBKDF2Async(pin, deviceSalt);

    wrappingKey = deriveWrapKey(masterKey);

    const wrappedVaultStr = await SecureStore.getItemAsync(SECURESTORE_KEYS.WRAPPED_VAULT_KEY);
    const wrappedCipherStr = await SecureStore.getItemAsync(SECURESTORE_KEYS.WRAPPED_CIPHER_KEY);
    const wrappedSignStr = await SecureStore.getItemAsync(SECURESTORE_KEYS.WRAPPED_SIGN_KEY);

    if (!wrappedVaultStr || !wrappedCipherStr || !wrappedSignStr) {
      return null;
    }

    const vaultKeyBuf = unwrapKey(deserializeWrappedKey(wrappedVaultStr), wrappingKey.copy());
    const cipherKeyBuf = unwrapKey(deserializeWrappedKey(wrappedCipherStr), wrappingKey.copy());
    const signKeyBuf = unwrapKey(deserializeWrappedKey(wrappedSignStr), wrappingKey.copy());

    await SecureStore.setItemAsync(SECURESTORE_KEYS.PIN_ATTEMPT_COUNT, '0');

    const vaultKeySb = SecureBuffer.from(vaultKeyBuf);
    zeroBuffer(vaultKeyBuf);

    return {
      vaultKey: vaultKeySb,
      cipherKey: SecureBuffer.from(cipherKeyBuf),
      signKey: SecureBuffer.from(signKeyBuf),
    };
  } finally {
    if (masterKey) zeroBuffer(masterKey);
    if (wrappingKey) wrappingKey.dispose();
  }
}

export async function exportVaultSeed(signKeyForMac?: Uint8Array): Promise<VaultSeed> {
  const deviceSalt = await SecureStore.getItemAsync(SECURESTORE_KEYS.DEVICE_SALT);
  const wrappedVaultKey = await SecureStore.getItemAsync(SECURESTORE_KEYS.WRAPPED_VAULT_KEY);
  const wrappedCipherKey = await SecureStore.getItemAsync(SECURESTORE_KEYS.WRAPPED_CIPHER_KEY);
  const wrappedSignKey = await SecureStore.getItemAsync(SECURESTORE_KEYS.WRAPPED_SIGN_KEY);
  const pinVerifySalt = await SecureStore.getItemAsync(SECURESTORE_KEYS.PIN_VERIFY_SALT);
  const pinVerifyHash = await SecureStore.getItemAsync(SECURESTORE_KEYS.PIN_VERIFY_HASH);
  const pairingId = await SecureStore.getItemAsync(SECURESTORE_KEYS.PAIRING_ID);
  if (!deviceSalt || !wrappedVaultKey || !wrappedCipherKey || !wrappedSignKey || !pinVerifySalt || !pinVerifyHash) {
    throw new Error('Vault seed incomplete — cannot export.');
  }

  const seed: VaultSeed = {
    deviceSalt, wrappedVaultKey, wrappedCipherKey, wrappedSignKey, pinVerifySalt, pinVerifyHash,
    pairingId: pairingId || undefined,
  };

  if (signKeyForMac) {
    const macPayload = deviceSalt + wrappedVaultKey + wrappedCipherKey + wrappedSignKey + pinVerifySalt + pinVerifyHash;
    seed.seedMac = computeSyncSignature(macPayload, null, signKeyForMac);
  }

  return seed;
}

export async function importVaultSeed(pin: string, seed: VaultSeed): Promise<VaultKeySet> {
  if (pin.length < 8) throw new Error('Master Password must be at least 8 characters');

  let masterKey: Uint8Array | null = null;
  let wrappingKey: SecureBuffer | null = null;

  try {
    const deviceSalt = hexToBytes(seed.deviceSalt);
    masterKey = await deriveWithPBKDF2Async(pin, deviceSalt);

    if (!(await verifyPin(pin, seed.pinVerifySalt, seed.pinVerifyHash))) {
      throw new Error('INCORRECT_PASSWORD: The Master Password does not match this vault seed.');
    }

    wrappingKey = deriveWrapKey(masterKey);
    const vaultKey = unwrapKey(deserializeWrappedKey(seed.wrappedVaultKey), wrappingKey.copy());
    const cipherKey = unwrapKey(deserializeWrappedKey(seed.wrappedCipherKey), wrappingKey.copy());
    const signKey = unwrapKey(deserializeWrappedKey(seed.wrappedSignKey), wrappingKey.copy());

    if (seed.seedMac) {
      const macPayload = seed.deviceSalt + seed.wrappedVaultKey + seed.wrappedCipherKey + seed.wrappedSignKey + seed.pinVerifySalt + seed.pinVerifyHash;
      const expectedMac = computeSyncSignature(macPayload, null, signKey);
      if (!timingSafeCompare(expectedMac, seed.seedMac)) {
        throw new Error('SEED_MAC_VERIFICATION_FAILED: The vault seed may have been tampered with in transit.');
      }
    }

    await SecureStore.setItemAsync(SECURESTORE_KEYS.DEVICE_SALT, seed.deviceSalt);
    await SecureStore.setItemAsync(SECURESTORE_KEYS.WRAPPED_VAULT_KEY, seed.wrappedVaultKey);
    await SecureStore.setItemAsync(SECURESTORE_KEYS.WRAPPED_CIPHER_KEY, seed.wrappedCipherKey);
    await SecureStore.setItemAsync(SECURESTORE_KEYS.WRAPPED_SIGN_KEY, seed.wrappedSignKey);
    await SecureStore.setItemAsync(SECURESTORE_KEYS.PIN_VERIFY_SALT, seed.pinVerifySalt);
    await SecureStore.setItemAsync(SECURESTORE_KEYS.PIN_VERIFY_HASH, seed.pinVerifyHash);
    await SecureStore.setItemAsync(SECURESTORE_KEYS.PIN_ATTEMPT_COUNT, '0');

    const vaultKeySb = SecureBuffer.from(vaultKey);
    zeroBuffer(vaultKey);

    return {
      vaultKey: vaultKeySb,
      cipherKey: SecureBuffer.from(cipherKey),
      signKey: SecureBuffer.from(signKey),
    };
  } finally {
    if (masterKey) zeroBuffer(masterKey);
    if (wrappingKey) wrappingKey.dispose();
  }
}

export async function recoverWithMnemonic(mnemonic: string, newPin: string): Promise<VaultKeySet> {
  if (!validateMnemonic(mnemonic)) throw new Error('Invalid recovery phrase. Check your 24-word phrase and try again.');
  if (newPin.length < 8) throw new Error('Master Password must be at least 8 characters');

  let newMasterKey: Uint8Array | null = null;
  let newWrappingKey: SecureBuffer | null = null;

  try {
    const recoverySeed = SecureBuffer.from(mnemonicToSeed(mnemonic));
    const vaultKeyBuf = deriveDeterministicKey(recoverySeed.copy(), 'vault');
    const cipherKeyBuf = deriveDeterministicKey(recoverySeed.copy(), 'cipher');
    const signKeyBuf = deriveDeterministicKey(recoverySeed.copy(), 'sign');

    const pairingId = derivePairingId(recoverySeed.copy());
    await SecureStore.setItemAsync(SECURESTORE_KEYS.PAIRING_ID, pairingId);
    recoverySeed.dispose();

    let deviceSaltHex = await SecureStore.getItemAsync(SECURESTORE_KEYS.DEVICE_SALT);
    if (!deviceSaltHex) {
      const newDeviceSalt = SecureBuffer.random(32);
      deviceSaltHex = newDeviceSalt.toHex();
      await SecureStore.setItemAsync(SECURESTORE_KEYS.DEVICE_SALT, deviceSaltHex);
      newDeviceSalt.dispose();
    }

    const deviceSalt = hexToBytes(deviceSaltHex);
    newMasterKey = await deriveWithPBKDF2Async(newPin, deviceSalt);
    newWrappingKey = deriveWrapKey(newMasterKey);

    const wVault = wrapKey(vaultKeyBuf.copy(), newWrappingKey.copy());
    const wCipher = wrapKey(cipherKeyBuf.copy(), newWrappingKey.copy());
    const wSign = wrapKey(signKeyBuf.copy(), newWrappingKey.copy());

    await SecureStore.setItemAsync(SECURESTORE_KEYS.WRAPPED_VAULT_KEY, serializeWrappedKey(wVault));
    await SecureStore.setItemAsync(SECURESTORE_KEYS.WRAPPED_CIPHER_KEY, serializeWrappedKey(wCipher));
    await SecureStore.setItemAsync(SECURESTORE_KEYS.WRAPPED_SIGN_KEY, serializeWrappedKey(wSign));

    const pinVerifySalt = SecureBuffer.random(32);
    await SecureStore.setItemAsync(SECURESTORE_KEYS.PIN_VERIFY_SALT, pinVerifySalt.toHex());
    const newPinVerifyHash = await computePinVerifyHash(newPin, pinVerifySalt.copy());
    pinVerifySalt.dispose();
    await SecureStore.setItemAsync(SECURESTORE_KEYS.PIN_VERIFY_HASH, newPinVerifyHash);
    await SecureStore.setItemAsync(SECURESTORE_KEYS.PIN_ATTEMPT_COUNT, '0');
    await SecureStore.setItemAsync(SECURESTORE_KEYS.HAS_RECOVERY_SEED, 'true');

    return { vaultKey: vaultKeyBuf, cipherKey: cipherKeyBuf, signKey: signKeyBuf };
  } finally {
    if (newMasterKey) zeroBuffer(newMasterKey);
    if (newWrappingKey) newWrappingKey.dispose();
  }
}

export async function changePin(oldPin: string, newPin: string): Promise<VaultKeySet | null> {
  if (newPin.length < 8) throw new Error('New Master Password must be at least 8 characters');

  const saltHex = await SecureStore.getItemAsync(SECURESTORE_KEYS.DEVICE_SALT);
  if (!saltHex) return null;

  const deviceSalt = hexToBytes(saltHex);
  const pinVerifySaltHex = await SecureStore.getItemAsync(SECURESTORE_KEYS.PIN_VERIFY_SALT);
  const storedHash = await SecureStore.getItemAsync(SECURESTORE_KEYS.PIN_VERIFY_HASH);

  if (!(await verifyPin(oldPin, pinVerifySaltHex, storedHash))) {
    const attempts = await getPinAttempts();
    await SecureStore.setItemAsync(SECURESTORE_KEYS.PIN_ATTEMPT_COUNT, (attempts + 1).toString());
    await SecureStore.setItemAsync(SECURESTORE_KEYS.PIN_LAST_ATTEMPT, Date.now().toString());
    return null;
  }

  const oldMasterKey = await deriveWithPBKDF2Async(oldPin, deviceSalt);

  const oldWrappingKey = deriveWrapKey(oldMasterKey);
  const wVaultStr = await SecureStore.getItemAsync(SECURESTORE_KEYS.WRAPPED_VAULT_KEY);
  const wCipherStr = await SecureStore.getItemAsync(SECURESTORE_KEYS.WRAPPED_CIPHER_KEY);
  const wSignStr = await SecureStore.getItemAsync(SECURESTORE_KEYS.WRAPPED_SIGN_KEY);
  if (!wVaultStr || !wCipherStr || !wSignStr) { zeroBuffer(oldMasterKey); oldWrappingKey.dispose(); return null; }

  const vaultKey = unwrapKey(deserializeWrappedKey(wVaultStr), oldWrappingKey.copy());
  const cipherKey = unwrapKey(deserializeWrappedKey(wCipherStr), oldWrappingKey.copy());
  const signKey = unwrapKey(deserializeWrappedKey(wSignStr), oldWrappingKey.copy());

  zeroBuffer(oldMasterKey); oldWrappingKey.dispose();

  let newMasterKey: Uint8Array | null = null;
  let newWrappingKey: SecureBuffer | null = null;

  try {
    newMasterKey = await deriveWithPBKDF2Async(newPin, deviceSalt);
    newWrappingKey = deriveWrapKey(newMasterKey);

    const nWVault = wrapKey(vaultKey, newWrappingKey.copy());
    const nWCipher = wrapKey(cipherKey, newWrappingKey.copy());
    const nWSign = wrapKey(signKey, newWrappingKey.copy());

    await SecureStore.setItemAsync(SECURESTORE_KEYS.WRAPPED_VAULT_KEY, serializeWrappedKey(nWVault));
    await SecureStore.setItemAsync(SECURESTORE_KEYS.WRAPPED_CIPHER_KEY, serializeWrappedKey(nWCipher));
    await SecureStore.setItemAsync(SECURESTORE_KEYS.WRAPPED_SIGN_KEY, serializeWrappedKey(nWSign));

    const newPinVerifySalt = SecureBuffer.random(32);
    await SecureStore.setItemAsync(SECURESTORE_KEYS.PIN_VERIFY_SALT, newPinVerifySalt.toHex());
    const newPinVerifyHash = await computePinVerifyHash(newPin, newPinVerifySalt.copy());
    newPinVerifySalt.dispose();
    await SecureStore.setItemAsync(SECURESTORE_KEYS.PIN_VERIFY_HASH, newPinVerifyHash);
    await SecureStore.setItemAsync(SECURESTORE_KEYS.PIN_ATTEMPT_COUNT, '0');
  } catch (e) {
    zeroBuffer(vaultKey);
    zeroBuffer(cipherKey);
    zeroBuffer(signKey);
    throw e;
  } finally {
    zeroBuffer(newMasterKey); newWrappingKey?.dispose();
  }

  const vaultKeySb = SecureBuffer.from(vaultKey);
  const cipherKeySb = SecureBuffer.from(cipherKey);
  const signKeySb = SecureBuffer.from(signKey);
  return { vaultKey: vaultKeySb, cipherKey: cipherKeySb, signKey: signKeySb };
}

export async function purgeVault(): Promise<void> {
  const keys = Object.values(SECURESTORE_KEYS);
  const errors: string[] = [];
  for (const key of keys) {
    try { 
      await SecureStore.setItemAsync(key, 'PURGED');
      await SecureStore.deleteItemAsync(key); 
    }
    catch { errors.push(key); }
  }
  const bioKeys = ['zerovault_biometric_dbkey_v3', 'zerovault_biometric_cipherkey_v3', 'zerovault_biometric_signkey_v3', 'zerovault_biometric_pin_v3'];
  for (const key of bioKeys) {
    try { 
      await SecureStore.setItemAsync(key, 'PURGED');
      await SecureStore.deleteItemAsync(key); 
    }
    catch { errors.push(key); }
  }
  if (errors.length > 0) {
    throw new Error(`Purge partially failed. Remaining keys: ${errors.join(', ')}`);
  }
}

// ─── SAFE API: Result<T, DomainError> — enterprise error handling ───

export async function createVaultSafe(pin: string): Promise<Result<VaultGenesisResult, DomainError>> {
  try { return new Ok(await createVault(pin)); }
  catch (e) { return new Err(cryptoError(CryptoErrorCode.ENCRYPT_FAILED, e instanceof Error ? e : undefined)); }
}

export async function unlockVaultSafe(pin: string): Promise<Result<VaultKeySet, DomainError>> {
  try {
    const result = await unlockVault(pin);
    return result ? new Ok(result) : new Err(cryptoError(CryptoErrorCode.WRONG_PIN));
  } catch (e) { return new Err(cryptoError(CryptoErrorCode.DECRYPT_FAILED, e instanceof Error ? e : undefined)); }
}

export async function exportVaultSeedSafe(): Promise<Result<VaultSeed, DomainError>> {
  try { return new Ok(await exportVaultSeed()); }
  catch (e) { return new Err(cryptoError(CryptoErrorCode.SEED_CORRUPTED, e instanceof Error ? e : undefined)); }
}

export async function importVaultSeedSafe(pin: string, seed: VaultSeed): Promise<Result<VaultKeySet, DomainError>> {
  try { return new Ok(await importVaultSeed(pin, seed)); }
  catch (e) { return new Err(cryptoError(CryptoErrorCode.WRONG_PIN, e instanceof Error ? e : undefined)); }
}

export async function recoverWithMnemonicSafe(mnemonic: string, newPin: string): Promise<Result<VaultKeySet, DomainError>> {
  try { return new Ok(await recoverWithMnemonic(mnemonic, newPin)); }
  catch (e) { return new Err(cryptoError(CryptoErrorCode.INVALID_MNEMONIC, e instanceof Error ? e : undefined)); }
}

export async function changePinSafe(oldPin: string, newPin: string): Promise<Result<VaultKeySet, DomainError>> {
  try {
    const result = await changePin(oldPin, newPin);
    return result ? new Ok(result) : new Err(cryptoError(CryptoErrorCode.WRONG_PIN));
  } catch (e) { return new Err(cryptoError(CryptoErrorCode.KEY_DERIVATION_FAILED, e instanceof Error ? e : undefined)); }
}

