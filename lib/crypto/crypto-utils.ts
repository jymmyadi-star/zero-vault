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

export function wrapKey(key: Uint8Array, wrappingKey: Uint8Array): WrappedKey {
  const iv = randomBytes(24);
  const aad = new Uint8Array(0);
  const cipher = xchacha20poly1305(wrappingKey, iv, aad);
  const ciphertext = cipher.encrypt(key);
  const tag = new Uint8Array(0);
  return { iv, ciphertext, tag };
}

export function unwrapKey(wrapped: WrappedKey, wrappingKey: Uint8Array): Uint8Array {
  const aad = new Uint8Array(0);
  const cipher = xchacha20poly1305(wrappingKey, wrapped.iv, aad);
  return cipher.decrypt(wrapped.ciphertext);
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
  return {
    v: 1,
    alg: 'xchacha20-poly1305',
    iv: bytesToHex(iv),
    ct: bytesToHex(encrypted),
    tag: bytesToHex(new Uint8Array(0)),
    aad,
  };
}

export function decryptPayload(
  envelope: EncryptedEnvelope,
  key: Uint8Array,
): Record<string, unknown> {
  const iv = hexToBytes(envelope.iv);
  const ct = hexToBytes(envelope.ct);
  const aadBytes = new TextEncoder().encode(envelope.aad);
  const cipher = xchacha20poly1305(key, iv, aadBytes);
  const decrypted = cipher.decrypt(ct);
  const plaintext = new TextDecoder().decode(decrypted);
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
  return hkdf(sha256, masterKey, new Uint8Array(0), info, 32);
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
  } catch {
    return deriveWithPBKDF2(password, salt, 150000, hashLength);
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
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export { Buffer };
