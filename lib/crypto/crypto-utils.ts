import { Buffer } from 'buffer';
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256, sha512 } from '@noble/hashes/sha2.js';
import { hmac } from '@noble/hashes/hmac.js';
import { pbkdf2, pbkdf2Async } from '@noble/hashes/pbkdf2.js';

export type EncryptedEnvelope = {
  v: number;
  alg: string;
  iv: string;
  ct: string;
  tag: string;
  aad: string;
};

export type WrappedKey = { iv: Uint8Array; ciphertext: Uint8Array; tag: Uint8Array };

export type WrappedKeySerializable = { iv: string; ciphertext: string; tag: string };

export function bytesToHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

export function hexToBytes(hex: string): Uint8Array {
  return new Uint8Array(Buffer.from(hex, 'hex'));
}

export function randomBytes(length: number): Uint8Array {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buf = new Uint8Array(length);
    crypto.getRandomValues(buf);
    return buf;
  }
  throw new Error('CRYPTO_UNAVAILABLE: crypto.getRandomValues is required for secure key generation.');
}

export function generateRandomKey(): Uint8Array {
  return randomBytes(32);
}

function concatUint8Arrays(a: Uint8Array, b: Uint8Array): Uint8Array {
  const result = new Uint8Array(a.length + b.length);
  result.set(a);
  result.set(b, a.length);
  return result;
}

const POLY1305_TAG_LENGTH = 16;

export function wrapKey(key: Uint8Array, wrappingKey: Uint8Array): WrappedKey {
  const iv = randomBytes(24);
  const aad = new Uint8Array(0);
  const cipher = xchacha20poly1305(wrappingKey, iv, aad);
  const encrypted = cipher.encrypt(key);
  const ciphertext = encrypted.slice(0, -POLY1305_TAG_LENGTH);
  const tag = encrypted.slice(-POLY1305_TAG_LENGTH);
  return { iv, ciphertext, tag };
}

export function unwrapKey(wrapped: WrappedKey, wrappingKey: Uint8Array): Uint8Array {
  const aad = new Uint8Array(0);
  const cipher = xchacha20poly1305(wrappingKey, wrapped.iv, aad);
  const combined = concatUint8Arrays(wrapped.ciphertext, wrapped.tag);
  return cipher.decrypt(combined);
}

export function serializeWrappedKey(wk: WrappedKey): string {
  return JSON.stringify({
    iv: bytesToHex(wk.iv),
    ciphertext: bytesToHex(wk.ciphertext),
    tag: bytesToHex(wk.tag),
  });
}

export function deserializeWrappedKey(serialized: string): WrappedKey {
  const parsed = JSON.parse(serialized) as WrappedKeySerializable;
  return {
    iv: hexToBytes(parsed.iv),
    ciphertext: hexToBytes(parsed.ciphertext),
    tag: hexToBytes(parsed.tag),
  };
}

export function encryptPayload(
  plaintextPayload: Record<string, unknown>,
  key: Uint8Array,
  aadContext?: Record<string, unknown>,
): EncryptedEnvelope {
  const iv = randomBytes(24);
  const aad = aadContext ? JSON.stringify(aadContext) : '{}';
  const aadBytes = new TextEncoder().encode(aad);
  const plaintext = JSON.stringify(plaintextPayload);
  const plaintextBytes = new TextEncoder().encode(plaintext);
  const cipher = xchacha20poly1305(key, iv, aadBytes);
  const encrypted = cipher.encrypt(plaintextBytes);
  const ct = encrypted.slice(0, -POLY1305_TAG_LENGTH);
  const tag = encrypted.slice(-POLY1305_TAG_LENGTH);
  return {
    v: 1,
    alg: 'xchacha20-poly1305',
    iv: bytesToHex(iv),
    ct: bytesToHex(ct),
    tag: bytesToHex(tag),
    aad,
  };
}

export function decryptPayload(
  envelope: EncryptedEnvelope,
  key: Uint8Array,
): Record<string, unknown> {
  const iv = hexToBytes(envelope.iv);
  const ct = hexToBytes(envelope.ct);
  const tag = hexToBytes(envelope.tag);
  const aadBytes = new TextEncoder().encode(envelope.aad);
  const cipher = xchacha20poly1305(key, iv, aadBytes);
  const combined = concatUint8Arrays(ct, tag);
  const decrypted = cipher.decrypt(combined);
  const plaintext = new TextDecoder().decode(decrypted);
  decrypted.fill(0);
  return JSON.parse(plaintext);
}

export function computeSyncSignature(
  payloadText: string,
  prevHash: string | null,
  signKey: Uint8Array,
): string {
  const prevBytes = prevHash ? new TextEncoder().encode(prevHash) : new Uint8Array(0);
  const payloadBytes = new TextEncoder().encode(payloadText);
  const data = concatUint8Arrays(prevBytes, payloadBytes);
  return bytesToHex(hmac(sha256, signKey, data));
}

export function deriveSignKey(masterKey: Uint8Array): Uint8Array {
  const info = new TextEncoder().encode('zerovault-sync-sign-v1');
  const salt = sha256(new TextEncoder().encode('zerovault-sign-salt-v1'));
  return hkdf(sha256, masterKey, salt, info, 32);
}

export async function deriveWithArgon2(
  password: string,
  salt: Uint8Array,
  {
    timeCost = 6,
    memoryCost = 131072,
    parallelism = 4,
    hashLength = 32,
  }: {
    timeCost?: number;
    memoryCost?: number;
    parallelism?: number;
    hashLength?: number;
  } = {},
): Promise<Uint8Array> {
  try {
    const { argon2id } = await import('argon2');
    // @ts-expect-error argon2 package types are incomplete for argon2id.hash
    const result = await argon2id.hash(password, {
      salt: Buffer.from(salt),
      timeCost,
      memoryCost,
      parallelism,
      hashLength,
      raw: true,
    });
    return new Uint8Array(result);
  } catch (err) {
    const fbErr = err instanceof Error ? err.message : String(err);
    throw new Error(`ARGON2_UNAVAILABLE: Argon2id is required for vault key derivation but could not be loaded. Reason: ${fbErr}. Ensure 'argon2' is installed and the native module is linked.`);
  }
}

export function deriveWithPBKDF2(
  password: string,
  salt: Uint8Array,
  iterations: number = 150000,
  length: number = 32,
): Uint8Array {
  const passwordBytes = new TextEncoder().encode(password);
  return pbkdf2(sha512, passwordBytes, salt, { c: iterations, dkLen: length });
}

export function timingSafeCompare(a: string, b: string): boolean {
  let mismatch = 0;
  const minLen = Math.min(a.length, b.length);
  for (let i = 0; i < minLen; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  mismatch |= a.length ^ b.length;
  return mismatch === 0;
}

export function mnemonicToSeed(mnemonic: string): Uint8Array {
  const pw = new TextEncoder().encode(mnemonic.trim().toLowerCase().replace(/\s+/g, ' '));
  return pbkdf2(sha512, pw, new TextEncoder().encode('mnemonic'), { c: 2048, dkLen: 64 });
}

export function deriveWithHKDF(masterKey: Uint8Array, info: string, length = 32): Uint8Array {
  return hkdf(sha256, masterKey, new Uint8Array(0), new TextEncoder().encode(info), length);
}

export { Buffer };

export function derivePairingId(seed: Uint8Array): string {
  const info = new TextEncoder().encode('zerovault-pairing-v1');
  const raw = hkdf(sha256, seed, new Uint8Array(0), info, 10);
  const hex = bytesToHex(raw);
  raw.fill(0);
  return hex;
}
