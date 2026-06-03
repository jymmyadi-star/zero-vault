import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256, sha512 } from '@noble/hashes/sha2.js';
import { hmac } from '@noble/hashes/hmac.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  return bytes;
}

export function randomBytes(length: number): Uint8Array {
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
  return { iv, ciphertext: cipher.encrypt(key), tag: new Uint8Array(0) };
}

export function unwrapKey(wrapped: WrappedKey, wrappingKey: Uint8Array): Uint8Array {
  const cipher = xchacha20poly1305(wrappingKey, wrapped.iv, new Uint8Array(0));
  return cipher.decrypt(wrapped.ciphertext);
}

export interface EncryptedEnvelope {
  v: number;
  alg: string;
  iv: string;
  ct: string;
  tag: string;
  aad: string;
}

export function encryptPayload(payload: Record<string, unknown>, key: Uint8Array): EncryptedEnvelope {
  const iv = randomBytes(24);
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const cipher = xchacha20poly1305(key, iv, new Uint8Array(0));
  return {
    v: 1,
    alg: 'xchacha20-poly1305',
    iv: bytesToHex(iv),
    ct: bytesToHex(cipher.encrypt(plaintext)),
    tag: '',
    aad: '{}',
  };
}

export function decryptPayload(envelope: EncryptedEnvelope, key: Uint8Array): Record<string, unknown> {
  const cipher = xchacha20poly1305(key, hexToBytes(envelope.iv), new Uint8Array(0));
  return JSON.parse(new TextDecoder().decode(cipher.decrypt(hexToBytes(envelope.ct))));
}

export function deriveWithPBKDF2(password: string, salt: Uint8Array, length = 32): Uint8Array {
  return pbkdf2(sha512, new TextEncoder().encode(password), salt, { c: 150_000, dkLen: length });
}

export function deriveWithHKDF(masterKey: Uint8Array, info: string, length = 32): Uint8Array {
  return hkdf(sha256, masterKey, new Uint8Array(0), new TextEncoder().encode(info), length);
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
  if (bufA.length !== bufB.length) return false;
  let mismatch = 0;
  for (let i = 0; i < bufA.length; i++) mismatch |= bufA[i]! ^ bufB[i]!;
  return mismatch === 0;
}
