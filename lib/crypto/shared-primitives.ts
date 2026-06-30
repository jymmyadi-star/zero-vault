import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256, sha512 } from '@noble/hashes/sha2.js';
import { hmac } from '@noble/hashes/hmac.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';

const POLY1305_TAG_LENGTH = 16;

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('Invalid hex string: odd length');
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  return bytes;
}

export function randomBytes(length: number): Uint8Array {
  if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
    throw new Error('CRYPTO_UNAVAILABLE: crypto.getRandomValues is required');
  }
  return crypto.getRandomValues(new Uint8Array(length));
}

export function generateRandomKey(): Uint8Array {
  return randomBytes(32);
}

export interface WrappedKey {
  iv: Uint8Array;
  ciphertext: Uint8Array;
  tag: Uint8Array;
}

export function wrapKey(key: Uint8Array, wrappingKey: Uint8Array): WrappedKey {
  const iv = randomBytes(24);
  const cipher = xchacha20poly1305(wrappingKey, iv, new Uint8Array(0));
  const encrypted = cipher.encrypt(key);
  return {
    iv,
    ciphertext: encrypted.slice(0, -POLY1305_TAG_LENGTH),
    tag: encrypted.slice(-POLY1305_TAG_LENGTH),
  };
}

export function unwrapKey(wrapped: WrappedKey, wrappingKey: Uint8Array): Uint8Array {
  const cipher = xchacha20poly1305(wrappingKey, wrapped.iv, new Uint8Array(0));
  const combined = new Uint8Array(wrapped.ciphertext.length + wrapped.tag.length);
  combined.set(wrapped.ciphertext);
  combined.set(wrapped.tag, wrapped.ciphertext.length);
  return cipher.decrypt(combined);
}

export interface EncryptedEnvelope {
  v: number;
  alg: string;
  iv: string;
  ct: string;
  tag: string;
  aad: string;
}

export function encryptPayload(payload: Record<string, unknown>, key: Uint8Array, aadContext?: Record<string, unknown>): EncryptedEnvelope {
  const iv = randomBytes(24);
  const aad = aadContext ? JSON.stringify(aadContext) : '{}';
  const aadBytes = new TextEncoder().encode(aad);
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const cipher = xchacha20poly1305(key, iv, aadBytes);
  const encrypted = cipher.encrypt(plaintext);
  return {
    v: 1,
    alg: 'xchacha20-poly1305',
    iv: bytesToHex(iv),
    ct: bytesToHex(encrypted.slice(0, -POLY1305_TAG_LENGTH)),
    tag: bytesToHex(encrypted.slice(-POLY1305_TAG_LENGTH)),
    aad,
  };
}

export function decryptPayload(envelope: EncryptedEnvelope, key: Uint8Array): Record<string, unknown> {
  const ct = hexToBytes(envelope.ct);
  const tag = hexToBytes(envelope.tag);
  const combined = new Uint8Array(ct.length + tag.length);
  combined.set(ct);
  combined.set(tag, ct.length);
  const cipher = xchacha20poly1305(key, hexToBytes(envelope.iv), new TextEncoder().encode(envelope.aad));
  const decrypted = cipher.decrypt(combined);
  const result = JSON.parse(new TextDecoder().decode(decrypted));
  decrypted.fill(0);
  return result;
}

export function deriveWithPBKDF2(password: string, salt: Uint8Array, length = 32): Uint8Array {
  return pbkdf2(sha512, new TextEncoder().encode(password), salt, { c: 150_000, dkLen: length });
}

export function deriveWithHKDF(masterKey: Uint8Array, info: string, length = 32): Uint8Array {
  return hkdf(sha256, masterKey, new Uint8Array(0), new TextEncoder().encode(info), length);
}

export function derivePairingId(seed: Uint8Array): string {
  const info = new TextEncoder().encode('zerovault-pairing-v1');
  const raw = hkdf(sha256, seed, new Uint8Array(0), info, 10);
  const hex = bytesToHex(raw);
  raw.fill(0);
  return hex;
}

export function mnemonicToSeed(mnemonic: string): Uint8Array {
  const pw = new TextEncoder().encode(mnemonic.trim().toLowerCase().replace(/\s+/g, ' '));
  return pbkdf2(sha512, pw, new TextEncoder().encode('mnemonic'), { c: 2048, dkLen: 64 });
}

export function computeSignature(payload: string, prevHash: string | null, key: Uint8Array): string {
  const prev = prevHash ? new TextEncoder().encode(prevHash) : new Uint8Array(0);
  const data = new Uint8Array(prev.length + new TextEncoder().encode(payload).length);
  data.set(prev);
  data.set(new TextEncoder().encode(payload), prev.length);
  return bytesToHex(hmac(sha256, key, data));
}

export function timingSafeCompare(a: string | Uint8Array, b: string | Uint8Array): boolean {
  const bufA = typeof a === 'string' ? new TextEncoder().encode(a) : a;
  const bufB = typeof b === 'string' ? new TextEncoder().encode(b) : b;
  let mismatch = 0;
  const minLen = Math.min(bufA.length, bufB.length);
  for (let i = 0; i < minLen; i++) mismatch |= bufA[i]! ^ bufB[i]!;
  mismatch |= bufA.length ^ bufB.length;
  return mismatch === 0;
}
