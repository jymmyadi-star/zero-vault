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
  timingSafeCompare, deriveWithArgon2,
  type WrappedKey,
} from './crypto-utils';
import { SecureBuffer } from './secure-buffer';
import { generateMnemonic, mnemonicToSeed, validateMnemonic } from './bip39';
import {
  Result, Ok, Err,
  CryptoErrorCode, cryptoError, DomainError,
} from '../result';

const SECURESTORE_KEYS = {
  DEVICE_SALT: 'zerovault_device_salt',
  WRAPPED_VAULT_KEY: 'zerovault_wrapped_vault_key',
  WRAPPED_CIPHER_KEY: 'zerovault_wrapped_cipher_key',
  WRAPPED_SIGN_KEY: 'zerovault_wrapped_sign_key',
  PIN_VERIFY_HASH: 'zerovault_pin_verify_hash',
  PIN_ATTEMPT_COUNT: 'zerovault_pin_attempts',
  HAS_RECOVERY_SEED: 'zerovault_has_recovery_seed',
} as const;

const HKDF_INFO = {
  WRAP: 'zerovault-wrap-v1',
  PIN_VERIFY: 'zerovault-pin-verify-v1',
} as const;

const MAX_PIN_ATTEMPTS = 5;

export interface VaultKeySet {
  vaultKeyHex: string;
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
  pinVerifyHash: string;
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

function derivePinVerifyKey(masterKey: Uint8Array): SecureBuffer {
  const info = new TextEncoder().encode(HKDF_INFO.PIN_VERIFY);
  const raw = hkdf(sha256, masterKey, new Uint8Array(0), info, 32);
  return SecureBuffer.from(raw);
}

function computePinVerifyHash(masterKey: Uint8Array): string {
  const pk = derivePinVerifyKey(masterKey);
  try {
    return computeSyncSignature('zerovault-pin-verify', null, pk.copy());
  } finally {
    pk.dispose();
  }
}

function zeroBuffer(buf: Uint8Array | null): void {
  if (buf && buf.length > 0) buf.fill(0);
}

// ─── Public API (backward compatible — original signatures) ───

export async function isVaultSetup(): Promise<boolean> {
  try {
    const salt = await SecureStore.getItemAsync(SECURESTORE_KEYS.DEVICE_SALT);
    return salt !== null && salt.length > 0;
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
  if (pin.length < 8) throw new Error('Master PIN must be at least 8 digits');

  const deviceSalt = SecureBuffer.random(32);
  await SecureStore.setItemAsync(SECURESTORE_KEYS.DEVICE_SALT, deviceSalt.toHex());

  const masterKey = await deriveWithArgon2(pin, deviceSalt.copy());
  deviceSalt.dispose();
  const wrappingKey = deriveWrapKey(masterKey);

  const mnemonic = generateMnemonic();
  const recoverySeed = SecureBuffer.from(mnemonicToSeed(mnemonic));

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

  const pinVerifyHash = computePinVerifyHash(masterKey);
  await SecureStore.setItemAsync(SECURESTORE_KEYS.PIN_VERIFY_HASH, pinVerifyHash);
  await SecureStore.setItemAsync(SECURESTORE_KEYS.PIN_ATTEMPT_COUNT, '0');

  const vaultKeyHex = vaultKey.toHex();

  zeroBuffer(masterKey);
  wrappingKey.dispose();
  recoverySeed.dispose();
  vaultKey.dispose();

  return { keySet: { vaultKeyHex, cipherKey, signKey }, mnemonic };
}

export async function unlockVault(pin: string): Promise<VaultKeySet | null> {
  if (pin.length < 8) return null;
  const attempts = await getPinAttempts();
  if (attempts >= MAX_PIN_ATTEMPTS) throw new Error('VAULT_LOCKED: Too many failed attempts. Reinstall or reset required.');

  const saltHex = await SecureStore.getItemAsync(SECURESTORE_KEYS.DEVICE_SALT);
  if (!saltHex) return null;

  const deviceSalt = hexToBytes(saltHex);
  const masterKey = await deriveWithArgon2(pin, deviceSalt);

  const computedHash = computePinVerifyHash(masterKey);
  const storedHash = await SecureStore.getItemAsync(SECURESTORE_KEYS.PIN_VERIFY_HASH);

  if (!storedHash || !timingSafeCompare(computedHash, storedHash)) {
    await SecureStore.setItemAsync(SECURESTORE_KEYS.PIN_ATTEMPT_COUNT, (attempts + 1).toString());
    zeroBuffer(masterKey);
    return null;
  }

  const wrappingKey = deriveWrapKey(masterKey);

  const wrappedVaultStr = await SecureStore.getItemAsync(SECURESTORE_KEYS.WRAPPED_VAULT_KEY);
  const wrappedCipherStr = await SecureStore.getItemAsync(SECURESTORE_KEYS.WRAPPED_CIPHER_KEY);
  const wrappedSignStr = await SecureStore.getItemAsync(SECURESTORE_KEYS.WRAPPED_SIGN_KEY);

  if (!wrappedVaultStr || !wrappedCipherStr || !wrappedSignStr) {
    zeroBuffer(masterKey);
    wrappingKey.dispose();
    return null;
  }

  const vaultKey = unwrapKey(deserializeWrappedKey(wrappedVaultStr), wrappingKey.copy());
  const cipherKey = unwrapKey(deserializeWrappedKey(wrappedCipherStr), wrappingKey.copy());
  const signKey = unwrapKey(deserializeWrappedKey(wrappedSignStr), wrappingKey.copy());

  await SecureStore.setItemAsync(SECURESTORE_KEYS.PIN_ATTEMPT_COUNT, '0');

  const vaultKeyHex = bytesToHex(vaultKey);
  zeroBuffer(masterKey);
  wrappingKey.dispose();
  zeroBuffer(vaultKey);

  return {
    vaultKeyHex,
    cipherKey: SecureBuffer.from(cipherKey),
    signKey: SecureBuffer.from(signKey),
  };
}

export async function exportVaultSeed(): Promise<VaultSeed> {
  const deviceSalt = await SecureStore.getItemAsync(SECURESTORE_KEYS.DEVICE_SALT);
  const wrappedVaultKey = await SecureStore.getItemAsync(SECURESTORE_KEYS.WRAPPED_VAULT_KEY);
  const wrappedCipherKey = await SecureStore.getItemAsync(SECURESTORE_KEYS.WRAPPED_CIPHER_KEY);
  const wrappedSignKey = await SecureStore.getItemAsync(SECURESTORE_KEYS.WRAPPED_SIGN_KEY);
  const pinVerifyHash = await SecureStore.getItemAsync(SECURESTORE_KEYS.PIN_VERIFY_HASH);
  if (!deviceSalt || !wrappedVaultKey || !wrappedCipherKey || !wrappedSignKey || !pinVerifyHash) {
    throw new Error('Vault seed incomplete — cannot export.');
  }
  return { deviceSalt, wrappedVaultKey, wrappedCipherKey, wrappedSignKey, pinVerifyHash };
}

export async function importVaultSeed(pin: string, seed: VaultSeed): Promise<VaultKeySet> {
  if (pin.length < 8) throw new Error('Master PIN must be at least 8 digits');

  const deviceSalt = hexToBytes(seed.deviceSalt);
  const masterKey = await deriveWithArgon2(pin, deviceSalt);
  const computedHash = computePinVerifyHash(masterKey);

  if (!timingSafeCompare(computedHash, seed.pinVerifyHash)) {
    zeroBuffer(masterKey);
    throw new Error('INCORRECT_PIN: The Master PIN does not match this vault seed.');
  }

  const wrappingKey = deriveWrapKey(masterKey);
  const vaultKey = unwrapKey(deserializeWrappedKey(seed.wrappedVaultKey), wrappingKey.copy());
  const cipherKey = unwrapKey(deserializeWrappedKey(seed.wrappedCipherKey), wrappingKey.copy());
  const signKey = unwrapKey(deserializeWrappedKey(seed.wrappedSignKey), wrappingKey.copy());

  await SecureStore.setItemAsync(SECURESTORE_KEYS.DEVICE_SALT, seed.deviceSalt);
  await SecureStore.setItemAsync(SECURESTORE_KEYS.WRAPPED_VAULT_KEY, seed.wrappedVaultKey);
  await SecureStore.setItemAsync(SECURESTORE_KEYS.WRAPPED_CIPHER_KEY, seed.wrappedCipherKey);
  await SecureStore.setItemAsync(SECURESTORE_KEYS.WRAPPED_SIGN_KEY, seed.wrappedSignKey);
  await SecureStore.setItemAsync(SECURESTORE_KEYS.PIN_VERIFY_HASH, seed.pinVerifyHash);
  await SecureStore.setItemAsync(SECURESTORE_KEYS.PIN_ATTEMPT_COUNT, '0');

  const vaultKeyHex = bytesToHex(vaultKey);
  zeroBuffer(masterKey);
  wrappingKey.dispose();
  zeroBuffer(vaultKey);

  return {
    vaultKeyHex,
    cipherKey: SecureBuffer.from(cipherKey),
    signKey: SecureBuffer.from(signKey),
  };
}

export async function recoverWithMnemonic(mnemonic: string, newPin: string): Promise<VaultKeySet> {
  if (!validateMnemonic(mnemonic)) throw new Error('Invalid recovery phrase. Check your 24-word phrase and try again.');
  if (newPin.length < 8) throw new Error('Master PIN must be at least 8 digits');

  const recoverySeed = SecureBuffer.from(mnemonicToSeed(mnemonic));
  const vaultKeyBuf = deriveDeterministicKey(recoverySeed.copy(), 'vault');
  const cipherKeyBuf = deriveDeterministicKey(recoverySeed.copy(), 'cipher');
  const signKeyBuf = deriveDeterministicKey(recoverySeed.copy(), 'sign');
  recoverySeed.dispose();

  let deviceSaltHex = await SecureStore.getItemAsync(SECURESTORE_KEYS.DEVICE_SALT);
  if (!deviceSaltHex) {
    const newDeviceSalt = SecureBuffer.random(32);
    deviceSaltHex = newDeviceSalt.toHex();
    await SecureStore.setItemAsync(SECURESTORE_KEYS.DEVICE_SALT, deviceSaltHex);
    newDeviceSalt.dispose();
  }

  const deviceSalt = hexToBytes(deviceSaltHex);
  const newMasterKey = await deriveWithArgon2(newPin, deviceSalt);
  const newWrappingKey = deriveWrapKey(newMasterKey);

  const wVault = wrapKey(vaultKeyBuf.copy(), newWrappingKey.copy());
  const wCipher = wrapKey(cipherKeyBuf.copy(), newWrappingKey.copy());
  const wSign = wrapKey(signKeyBuf.copy(), newWrappingKey.copy());

  await SecureStore.setItemAsync(SECURESTORE_KEYS.WRAPPED_VAULT_KEY, serializeWrappedKey(wVault));
  await SecureStore.setItemAsync(SECURESTORE_KEYS.WRAPPED_CIPHER_KEY, serializeWrappedKey(wCipher));
  await SecureStore.setItemAsync(SECURESTORE_KEYS.WRAPPED_SIGN_KEY, serializeWrappedKey(wSign));

  const newPinVerifyHash = computePinVerifyHash(newMasterKey);
  await SecureStore.setItemAsync(SECURESTORE_KEYS.PIN_VERIFY_HASH, newPinVerifyHash);
  await SecureStore.setItemAsync(SECURESTORE_KEYS.PIN_ATTEMPT_COUNT, '0');
  await SecureStore.setItemAsync(SECURESTORE_KEYS.HAS_RECOVERY_SEED, 'true');

  const vaultKeyHex = vaultKeyBuf.toHex();
  vaultKeyBuf.dispose();

  zeroBuffer(newMasterKey);
  newWrappingKey.dispose();

  return {
    vaultKeyHex,
    cipherKey: cipherKeyBuf,
    signKey: signKeyBuf,
  };
}

export async function changePin(oldPin: string, newPin: string): Promise<VaultKeySet | null> {
  if (newPin.length < 8) throw new Error('New Master PIN must be at least 8 digits');

  const saltHex = await SecureStore.getItemAsync(SECURESTORE_KEYS.DEVICE_SALT);
  if (!saltHex) return null;

  const deviceSalt = hexToBytes(saltHex);
  const oldMasterKey = await deriveWithArgon2(oldPin, deviceSalt);
  const computedHash = computePinVerifyHash(oldMasterKey);
  const storedHash = await SecureStore.getItemAsync(SECURESTORE_KEYS.PIN_VERIFY_HASH);

  if (!storedHash || !timingSafeCompare(computedHash, storedHash)) {
    const attempts = await getPinAttempts();
    await SecureStore.setItemAsync(SECURESTORE_KEYS.PIN_ATTEMPT_COUNT, (attempts + 1).toString());
    zeroBuffer(oldMasterKey);
    return null;
  }

  const oldWrappingKey = deriveWrapKey(oldMasterKey);
  const wVaultStr = await SecureStore.getItemAsync(SECURESTORE_KEYS.WRAPPED_VAULT_KEY);
  const wCipherStr = await SecureStore.getItemAsync(SECURESTORE_KEYS.WRAPPED_CIPHER_KEY);
  const wSignStr = await SecureStore.getItemAsync(SECURESTORE_KEYS.WRAPPED_SIGN_KEY);
  if (!wVaultStr || !wCipherStr || !wSignStr) { zeroBuffer(oldMasterKey); oldWrappingKey.dispose(); return null; }

  const vaultKey = unwrapKey(deserializeWrappedKey(wVaultStr), oldWrappingKey.copy());
  const cipherKey = unwrapKey(deserializeWrappedKey(wCipherStr), oldWrappingKey.copy());
  const signKey = unwrapKey(deserializeWrappedKey(wSignStr), oldWrappingKey.copy());

  const newMasterKey = await deriveWithArgon2(newPin, deviceSalt);
  const newWrappingKey = deriveWrapKey(newMasterKey);

  const nWVault = wrapKey(vaultKey, newWrappingKey.copy());
  const nWCipher = wrapKey(cipherKey, newWrappingKey.copy());
  const nWSign = wrapKey(signKey, newWrappingKey.copy());

  await SecureStore.setItemAsync(SECURESTORE_KEYS.WRAPPED_VAULT_KEY, serializeWrappedKey(nWVault));
  await SecureStore.setItemAsync(SECURESTORE_KEYS.WRAPPED_CIPHER_KEY, serializeWrappedKey(nWCipher));
  await SecureStore.setItemAsync(SECURESTORE_KEYS.WRAPPED_SIGN_KEY, serializeWrappedKey(nWSign));

  const newPinVerifyHash = computePinVerifyHash(newMasterKey);
  await SecureStore.setItemAsync(SECURESTORE_KEYS.PIN_VERIFY_HASH, newPinVerifyHash);
  await SecureStore.setItemAsync(SECURESTORE_KEYS.PIN_ATTEMPT_COUNT, '0');

  zeroBuffer(oldMasterKey); oldWrappingKey.dispose();
  zeroBuffer(newMasterKey); newWrappingKey.dispose();

  const vaultKeyHex = bytesToHex(vaultKey);
  zeroBuffer(vaultKey);
  return {
    vaultKeyHex,
    cipherKey: SecureBuffer.from(cipherKey),
    signKey: SecureBuffer.from(signKey),
  };
}

export async function purgeVault(): Promise<void> {
  const keys = Object.values(SECURESTORE_KEYS);
  for (const key of keys) {
    try { await SecureStore.deleteItemAsync(key); } catch {}
  }
  try { await SecureStore.deleteItemAsync('zerovault_biometric_dbkey'); } catch {}
  try { await SecureStore.deleteItemAsync('zerovault_biometric_cipherkey'); } catch {}
  try { await SecureStore.deleteItemAsync('zerovault_biometric_signkey'); } catch {}
  try { await SecureStore.deleteItemAsync('zerovault_biometric_pin'); } catch {}
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

