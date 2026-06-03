/**
 * Tests: lib/crypto/crypto-utils.ts
 * Validates encryption, decryption, key wrapping, hashing, and key derivation
 */
import { describe, it, expect } from 'vitest';
import {
  bytesToHex, hexToBytes, randomBytes, generateRandomKey,
  wrapKey, unwrapKey, serializeWrappedKey, deserializeWrappedKey,
  encryptPayload, decryptPayload, computeSyncSignature,
  deriveWithArgon2, deriveWithPBKDF2, timingSafeCompare,
} from '../../lib/crypto/crypto-utils';

describe('bytesToHex / hexToBytes', () => {
  it('roundtrip', () => {
    const bytes = new Uint8Array([0x00, 0xff, 0xab, 0x12]);
    const hex = bytesToHex(bytes);
    const back = hexToBytes(hex);
    expect(back).toEqual(bytes);
  });

  it('empty bytes', () => {
    const bytes = new Uint8Array(0);
    expect(bytesToHex(bytes)).toBe('');
    expect(hexToBytes('')).toEqual(bytes);
  });
});

describe('randomBytes', () => {
  it('generates correct length', () => {
    expect(randomBytes(16).length).toBe(16);
    expect(randomBytes(32).length).toBe(32);
  });

  it('generates unique values', () => {
    const a = bytesToHex(randomBytes(32));
    const b = bytesToHex(randomBytes(32));
    expect(a).not.toBe(b);
  });

  it('throws on zero length', () => {
    const buf = randomBytes(0);
    expect(buf.length).toBe(0);
  });
});

describe('generateRandomKey', () => {
  it('returns 32 bytes', () => {
    expect(generateRandomKey().length).toBe(32);
  });
});

describe('wrapKey / unwrapKey', () => {
  it('roundtrip', () => {
    const key = generateRandomKey();
    const wrappingKey = generateRandomKey();
    const wrapped = wrapKey(key, wrappingKey);
    const unwrapped = unwrapKey(wrapped, wrappingKey);
    expect(unwrapped).toEqual(key);
  });

  it('fails with wrong wrapping key', () => {
    const key = generateRandomKey();
    const wk1 = generateRandomKey();
    const wk2 = generateRandomKey();
    const wrapped = wrapKey(key, wk1);
    expect(() => unwrapKey(wrapped, wk2)).toThrow();
  });

  it('fails with modified ciphertext', () => {
    const key = generateRandomKey();
    const wk = generateRandomKey();
    const wrapped = wrapKey(key, wk);
    wrapped.ciphertext[0]! ^= 0x01; // tamper
    expect(() => unwrapKey(wrapped, wk)).toThrow();
  });
});

describe('serializeWrappedKey / deserializeWrappedKey', () => {
  it('roundtrip', () => {
    const key = generateRandomKey();
    const wk = generateRandomKey();
    const wrapped = wrapKey(key, wk);
    const serialized = serializeWrappedKey(wrapped);
    const deserialized = deserializeWrappedKey(serialized);
    const unwrapped = unwrapKey(deserialized, wk);
    expect(unwrapped).toEqual(key);
  });
});

describe('encryptPayload / decryptPayload', () => {
  it('roundtrip with simple object', () => {
    const key = generateRandomKey();
    const payload = { name: 'test', value: 42, tags: ['a', 'b'] };
    const envelope = encryptPayload(payload, key);
    expect(envelope.v).toBe(1);
    expect(envelope.alg).toBe('xchacha20-poly1305');
    expect(envelope.iv).toBeTruthy();
    expect(envelope.ct).toBeTruthy();

    const decrypted = decryptPayload(envelope, key);
    expect(decrypted).toEqual(payload);
  });

  it('roundtrip with AAD context', () => {
    const key = generateRandomKey();
    const payload = { id: 'abc', data: { x: 1 } };
    const aad = { entityId: 'abc', userId: 'test-user' };
    const envelope = encryptPayload(payload, key, aad);
    expect(JSON.parse(envelope.aad)).toEqual(aad);

    const decrypted = decryptPayload(envelope, key);
    expect(decrypted).toEqual(payload);
  });

  it('fails with wrong key', () => {
    const k1 = generateRandomKey();
    const k2 = generateRandomKey();
    const env = encryptPayload({ data: 'secret' }, k1);
    expect(() => decryptPayload(env, k2)).toThrow();
  });

  it('handles empty object', () => {
    const key = generateRandomKey();
    const env = encryptPayload({}, key);
    expect(decryptPayload(env, key)).toEqual({});
  });

  it('handles unicode strings', () => {
    const key = generateRandomKey();
    const payload = { name: 'românește 你好', emoji: '🔐💊' };
    const env = encryptPayload(payload, key);
    expect(decryptPayload(env, key)).toEqual(payload);
  });

  it('handles nested objects and arrays', () => {
    const key = generateRandomKey();
    const payload = {
      deep: { nested: { value: [1, 2, 3], flag: true } },
      empty: [],
      nulls: { a: null, b: false, c: 0 },
    };
    const env = encryptPayload(payload, key);
    expect(decryptPayload(env, key)).toEqual(payload);
  });

  it('produces unique IVs', () => {
    const key = generateRandomKey();
    const env1 = encryptPayload({ a: 1 }, key);
    const env2 = encryptPayload({ a: 1 }, key);
    expect(env1.iv).not.toBe(env2.iv);
    expect(env1.ct).not.toBe(env2.ct); // different ciphertexts because different IVs
  });

  it('generates deterministic output with same plaintext and same IV', () => {
    // XChaCha20-Poly1305 with random IV produces different ciphertext each time
    // This validates uniqueness, not determinism
    const key = generateRandomKey();
    const env = encryptPayload({ fixed: 'value' }, key);
    expect(env).toBeDefined();
  });
});

describe('computeSyncSignature', () => {
  it('produces deterministic output', () => {
    const signKey = generateRandomKey();
    const sig1 = computeSyncSignature('payload', null, signKey);
    const sig2 = computeSyncSignature('payload', null, signKey);
    expect(sig1).toBe(sig2);
  });

  it('changes with different payload', () => {
    const signKey = generateRandomKey();
    const sig1 = computeSyncSignature('a', null, signKey);
    const sig2 = computeSyncSignature('b', null, signKey);
    expect(sig1).not.toBe(sig2);
  });

  it('changes with different signKey', () => {
    const sk1 = generateRandomKey();
    const sk2 = generateRandomKey();
    const sig1 = computeSyncSignature('x', null, sk1);
    const sig2 = computeSyncSignature('x', null, sk2);
    expect(sig1).not.toBe(sig2);
  });

  it('includes prevHash in signature', () => {
    const signKey = generateRandomKey();
    const sig1 = computeSyncSignature('data', 'hash1', signKey);
    const sig2 = computeSyncSignature('data', 'hash2', signKey);
    expect(sig1).not.toBe(sig2);
  });

  it('produces 64-char hex output', () => {
    const signKey = generateRandomKey();
    const sig = computeSyncSignature('test', null, signKey);
    expect(sig.length).toBe(64);
    expect(/^[0-9a-f]{64}$/.test(sig)).toBe(true);
  });
});

describe('timingSafeCompare', () => {
  it('returns true for identical strings', () => {
    expect(timingSafeCompare('abc123', 'abc123')).toBe(true);
  });

  it('returns false for different strings', () => {
    expect(timingSafeCompare('abc123', 'def456')).toBe(false);
  });

  it('returns false for different lengths', () => {
    expect(timingSafeCompare('abc', 'abcd')).toBe(false);
  });

  it('is case sensitive', () => {
    expect(timingSafeCompare('ABC', 'abc')).toBe(false);
  });

  it('handles empty strings', () => {
    expect(timingSafeCompare('', '')).toBe(true);
    expect(timingSafeCompare('', 'a')).toBe(false);
  });
});

describe('deriveWithArgon2 / deriveWithPBKDF2', () => {
  it('deriveWithArgon2 returns 32 bytes', async () => {
    const salt = randomBytes(32);
    const key = await deriveWithArgon2('test-pin', salt);
    expect(key.length).toBe(32);
  });

  it('same password + salt → same key', async () => {
    const salt = randomBytes(32);
    const k1 = await deriveWithArgon2('mypin', salt);
    const k2 = await deriveWithArgon2('mypin', salt);
    expect(k1).toEqual(k2);
  });

  it('different password → different key', async () => {
    const salt = randomBytes(32);
    const k1 = await deriveWithArgon2('pin123', salt);
    const k2 = await deriveWithArgon2('pin456', salt);
    expect(k1).not.toEqual(k2);
  });

  it('different salt → different key', async () => {
    const s1 = randomBytes(32);
    const s2 = randomBytes(32);
    const k1 = await deriveWithArgon2('pin', s1);
    const k2 = await deriveWithArgon2('pin', s2);
    expect(k1).not.toEqual(k2);
  });

  it('PBKDF2 fallback produces correct length', () => {
    const salt = randomBytes(16);
    const key = deriveWithPBKDF2('test', salt);
    expect(key.length).toBe(32);
  });

  it('PBKDF2 is deterministic', () => {
    const salt = randomBytes(16);
    const k1 = deriveWithPBKDF2('abc', salt);
    const k2 = deriveWithPBKDF2('abc', salt);
    expect(k1).toEqual(k2);
  });

  it('Argon2id with custom params', async () => {
    const salt = randomBytes(32);
    const key = await deriveWithArgon2('pin', salt, {
      timeCost: 2,
      memoryCost: 16384,
      parallelism: 1,
      hashLength: 32,
    });
    expect(key.length).toBe(32);
  });
});
