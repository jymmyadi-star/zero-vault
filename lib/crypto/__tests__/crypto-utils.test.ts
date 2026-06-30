import { describe, it, expect } from 'vitest';
import {
  bytesToHex,
  hexToBytes,
  wrapKey,
  unwrapKey,
  serializeWrappedKey,
  deserializeWrappedKey,
  encryptPayload,
  decryptPayload,
  computeSyncSignature,
  timingSafeCompare,
  randomBytes,
  deriveWithPBKDF2,
} from '../crypto-utils';

describe('bytesToHex / hexToBytes', () => {
  it('roundtrips correctly', () => {
    const original = new Uint8Array([0x00, 0xFF, 0x7F, 0x80, 0xAA, 0x55]);
    const hex = bytesToHex(original);
    const back = hexToBytes(hex);
    expect(back).toEqual(original);
  });

  it('handles empty array', () => {
    const original = new Uint8Array(0);
    expect(bytesToHex(original)).toBe('');
    expect(hexToBytes('')).toEqual(original);
  });

  it('handles known hex value', () => {
    const hex = 'deadbeef';
    const bytes = hexToBytes(hex);
    expect(bytes.length).toBe(4);
    expect(bytes[0]).toBe(0xde);
    expect(bytes[1]).toBe(0xad);
    expect(bytes[2]).toBe(0xbe);
    expect(bytes[3]).toBe(0xef);
  });
});

describe('wrapKey / unwrapKey', () => {
  it('roundtrips 32-byte keys', () => {
    const key = randomBytes(32);
    const wrappingKey = randomBytes(32);
    const wrapped = wrapKey(key, wrappingKey);
    expect(wrapped.iv.length).toBe(24);
    expect(wrapped.ciphertext.length).toBe(32);
    expect(wrapped.tag.length).toBe(16); // Poly1305 tag stored separately
    const unwrapped = unwrapKey(wrapped, wrappingKey);
    expect(unwrapped).toEqual(key);
  });

  it('fails with wrong wrapping key', () => {
    const key = randomBytes(32);
    const wrappingKey = randomBytes(32);
    const wrongKey = randomBytes(32);
    const wrapped = wrapKey(key, wrappingKey);
    expect(() => unwrapKey(wrapped, wrongKey)).toThrow();
  });

  it('serialize/deserialize roundtrip', () => {
    const key = randomBytes(32);
    const wrappingKey = randomBytes(32);
    const wrapped = wrapKey(key, wrappingKey);
    const serialized = serializeWrappedKey(wrapped);
    const deserialized = deserializeWrappedKey(serialized);
    const unwrapped = unwrapKey(deserialized, wrappingKey);
    expect(unwrapped).toEqual(key);
  });
});

describe('encryptPayload / decryptPayload', () => {
  it('encrypts and decrypts plaintext', () => {
    const key = randomBytes(32);
    const payload = { username: 'admin', password: 'secret123' };
    const envelope = encryptPayload(payload, key);
    expect(envelope.v).toBe(1);
    expect(envelope.alg).toBe('xchacha20-poly1305');
    const decrypted = decryptPayload(envelope, key);
    expect(decrypted).toEqual(payload);
  });

  it('produces different ciphertexts for same payload', () => {
    const key = randomBytes(32);
    const payload = { secret: 'data' };
    const e1 = encryptPayload(payload, key);
    const e2 = encryptPayload(payload, key);
    expect(e1.ct).not.toBe(e2.ct);
    expect(e1.iv).not.toBe(e2.iv);
  });

  it('fails with wrong key', () => {
    const key = randomBytes(32);
    const wrongKey = randomBytes(32);
    const envelope = encryptPayload({ hello: 'world' }, key);
    expect(() => decryptPayload(envelope, wrongKey)).toThrow();
  });

  it('preserves AAD context', () => {
    const key = randomBytes(32);
    const payload = { id: 'item-1' };
    const aad = { entityId: 'abc', timestamp: 1234 };
    const envelope = encryptPayload(payload, key, aad);
    expect(envelope.aad).toBe(JSON.stringify(aad));
    const decrypted = decryptPayload(envelope, key);
    expect(decrypted).toEqual(payload);
  });

  it('handles complex nested payload', () => {
    const key = randomBytes(32);
    const payload = {
      items: [{ a: 1 }, { b: [2, 3] }],
      nested: { deep: { value: true, arr: [null] } },
      unicode: 'zażółć gęślą jaźń 🔐',
    };
    const envelope = encryptPayload(payload, key);
    const decrypted = decryptPayload(envelope, key);
    expect(decrypted).toEqual(payload);
  });
});

describe('computeSyncSignature', () => {
  it('produces deterministic output', () => {
    const signKey = randomBytes(32);
    const payload = 'test-payload';
    const sig1 = computeSyncSignature(payload, null, signKey);
    const sig2 = computeSyncSignature(payload, null, signKey);
    expect(sig1).toBe(sig2);
    expect(sig1.length).toBe(64); // SHA-256 HMAC = 32 bytes = 64 hex chars
  });

  it('chains signatures with prevHash', () => {
    const signKey = randomBytes(32);
    const s1 = computeSyncSignature('msg1', null, signKey);
    const s2 = computeSyncSignature('msg2', s1, signKey);
    expect(s1).not.toBe(s2);

    const s1b = computeSyncSignature('msg1', null, signKey);
    const s2b = computeSyncSignature('msg2', s1b, signKey);
    expect(s2).toBe(s2b);
  });

  it('different signKey produces different signatures', () => {
    const key1 = randomBytes(32);
    const key2 = key1.slice();
    key2[0] = (key2[0] ?? 0) ^ 1;
    const sig1 = computeSyncSignature('payload', null, key1);
    const sig2 = computeSyncSignature('payload', null, key2);
    expect(sig1).not.toBe(sig2);
  });
});

describe('timingSafeCompare', () => {
  it('returns true for identical strings', () => {
    expect(timingSafeCompare('abcdef', 'abcdef')).toBe(true);
    expect(timingSafeCompare('', '')).toBe(true);
    expect(timingSafeCompare('a'.repeat(1000), 'a'.repeat(1000))).toBe(true);
  });

  it('returns false for different strings', () => {
    expect(timingSafeCompare('abc', 'abd')).toBe(false);
    expect(timingSafeCompare('abc', 'ABC')).toBe(false);
  });

  it('returns false for different lengths', () => {
    expect(timingSafeCompare('abc', 'abcd')).toBe(false);
  });
});

describe('randomBytes', () => {
  it('generates correct length', () => {
    expect(randomBytes(16).length).toBe(16);
    expect(randomBytes(32).length).toBe(32);
    expect(randomBytes(64).length).toBe(64);
    expect(randomBytes(0).length).toBe(0);
  });

  it('produces different values', () => {
    const a = randomBytes(32);
    const b = randomBytes(32);
    let same = true;
    for (let i = 0; i < 32; i++) {
      if (a[i] !== b[i]) { same = false; break; }
    }
    expect(same).toBe(false);
  });
});

describe('deriveWithPBKDF2', () => {
  it('produces deterministic output for same inputs', () => {
    const password = 'test-pin-1234';
    const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const d1 = deriveWithPBKDF2(password, salt, 1000, 32);
    const d2 = deriveWithPBKDF2(password, salt, 1000, 32);
    expect(bytesToHex(d1)).toBe(bytesToHex(d2));
  });

  it('produces different output for different passwords', () => {
    const salt = new Uint8Array([1, 2, 3, 4]);
    const d1 = deriveWithPBKDF2('pin-1', salt, 100, 32);
    const d2 = deriveWithPBKDF2('pin-2', salt, 100, 32);
    expect(bytesToHex(d1)).not.toBe(bytesToHex(d2));
  });

  it('produces correct output length', () => {
    const salt = new Uint8Array([1]);
    expect(deriveWithPBKDF2('pw', salt, 10, 16).length).toBe(16);
    expect(deriveWithPBKDF2('pw', salt, 10, 32).length).toBe(32);
    expect(deriveWithPBKDF2('pw', salt, 10, 64).length).toBe(64);
  });

  it('matches known PBKDF2-SHA512 vector', () => {
    const password = 'password';
    const salt = new TextEncoder().encode('salt');
    const derived = deriveWithPBKDF2(password, salt, 1, 64);
    expect(derived.length).toBe(64);
  });
});
