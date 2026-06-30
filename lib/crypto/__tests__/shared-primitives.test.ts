import { describe, it, expect } from 'vitest';
import {
  bytesToHex,
  hexToBytes,
  randomBytes,
  generateRandomKey,
  wrapKey,
  unwrapKey,
  encryptPayload,
  decryptPayload,
  deriveWithPBKDF2,
  deriveWithHKDF,
  mnemonicToSeed,
  computeSignature,
  timingSafeCompare,
} from '../shared-primitives';

describe('Shared Crypto Primitives — Fuzz & Edge Cases', () => {
  describe('bytesToHex / hexToBytes roundtrip', () => {
    it('roundtrips random bytes', () => {
      for (let i = 0; i < 10; i++) {
        const original = randomBytes(32);
        const hex = bytesToHex(original);
        const back = hexToBytes(hex);
        expect(back).toEqual(original);
      }
    });

    it('handles empty buffer', () => {
      expect(bytesToHex(new Uint8Array(0))).toBe('');
      expect(hexToBytes('')).toEqual(new Uint8Array(0));
    });

    it('handles single byte', () => {
      expect(bytesToHex(new Uint8Array([0]))).toBe('00');
      expect(bytesToHex(new Uint8Array([255]))).toBe('ff');
    });

    it('hexToBytes rejects odd-length hex', () => {
      expect(() => hexToBytes('abc')).toThrow('Invalid hex string');
    });

    it('hexToBytes handles uppercase', () => {
      expect(hexToBytes('FF')).toEqual(new Uint8Array([255]));
    });
  });

  describe('wrapKey / unwrapKey', () => {
    it('roundtrips keys', () => {
      for (let i = 0; i < 5; i++) {
        const key = generateRandomKey();
        const wKey = generateRandomKey();
        const wrapped = wrapKey(key, wKey);
        const unwrapped = unwrapKey(wrapped, wKey);
        expect(unwrapped).toEqual(key);
      }
    });

    it('fails with wrong wrapping key', () => {
      const key = generateRandomKey();
      const wrapped = wrapKey(key, generateRandomKey());
      expect(() => unwrapKey(wrapped, generateRandomKey())).toThrow();
    });

    it('handles empty key as valid input', () => {
      const result = wrapKey(new Uint8Array(0), generateRandomKey());
      expect(result).toBeDefined();
      expect(result.ciphertext).toBeDefined();
    });

    it('rejects tampered ciphertext', () => {
      const key = generateRandomKey();
      const wKey = generateRandomKey();
      const wrapped = wrapKey(key, wKey);
      wrapped.ciphertext[0]! ^= 1;
      expect(() => unwrapKey(wrapped, wKey)).toThrow();
    });

    it('rejects wrong IV length', () => {
      const wrapped = { iv: new Uint8Array(12), ciphertext: new Uint8Array(32), tag: new Uint8Array(0) };
      expect(() => unwrapKey(wrapped as any, generateRandomKey())).toThrow();
    });
  });

  describe('encryptPayload / decryptPayload', () => {
    it('roundtrips various payloads', () => {
      const payloads = [
        { a: 1 },
        { text: 'hello world' },
        { arr: [1, 2, 3], nested: { deep: true } },
        { empty: '', null: null as any, zero: 0 },
      ];
      for (const payload of payloads) {
        const key = generateRandomKey();
        const envelope = encryptPayload(payload, key);
        const decrypted = decryptPayload(envelope, key);
        expect(decrypted).toEqual(payload);
      }
    });

    it('detects tampered ciphertext', () => {
      const key = generateRandomKey();
      const envelope = encryptPayload({ data: 'secret' }, key);
      const tampered = { ...envelope, ct: '00' + envelope.ct.slice(2) };
      expect(() => decryptPayload(tampered, key)).toThrow();
    });

    it('detects wrong key', () => {
      const envelope = encryptPayload({ data: 'secret' }, generateRandomKey());
      expect(() => decryptPayload(envelope, generateRandomKey())).toThrow();
    });
  });

  describe('deriveWithPBKDF2', () => {
    it('produces correct length', () => {
      const salt = randomBytes(16);
      const key = deriveWithPBKDF2('test-password', salt, 32);
      expect(key.length).toBe(32);
    });

    it('is deterministic', () => {
      const salt = randomBytes(16);
      const a = deriveWithPBKDF2('same', salt);
      const b = deriveWithPBKDF2('same', salt);
      expect(a).toEqual(b);
    });

    it('different passwords produce different keys', () => {
      const salt = randomBytes(16);
      expect(deriveWithPBKDF2('a', salt)).not.toEqual(deriveWithPBKDF2('b', salt));
    });

    it('handles empty password (produces deterministic output)', () => {
      const salt = randomBytes(16);
      const key = deriveWithPBKDF2('', salt, 32);
      expect(key.length).toBe(32);
      expect(key).toEqual(deriveWithPBKDF2('', salt, 32));
    });

    it('handles empty salt (produces deterministic output)', () => {
      const key = deriveWithPBKDF2('pw', new Uint8Array(0), 32);
      expect(key.length).toBe(32);
      expect(key).toEqual(deriveWithPBKDF2('pw', new Uint8Array(0), 32));
    });
  });

  describe('deriveWithHKDF', () => {
    it('produces correct length', () => {
      const key = deriveWithHKDF(generateRandomKey(), 'test-info');
      expect(key.length).toBe(32);
    });

    it('is deterministic', () => {
      const master = generateRandomKey();
      expect(deriveWithHKDF(master, 'info')).toEqual(deriveWithHKDF(master, 'info'));
    });

    it('different info produces different keys', () => {
      const master = generateRandomKey();
      expect(deriveWithHKDF(master, 'a')).not.toEqual(deriveWithHKDF(master, 'b'));
    });
  });

  describe('mnemonicToSeed', () => {
    it('produces 64-byte seed', () => {
      const seed = mnemonicToSeed('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
      expect(seed.length).toBe(64);
    });

    it('is deterministic', () => {
      const a = mnemonicToSeed('test phrase one two three four five six seven eight nine ten eleven twelve');
      const b = mnemonicToSeed('test phrase one two three four five six seven eight nine ten eleven twelve');
      expect(a).toEqual(b);
    });

    it('different mnemonics produce different seeds', () => {
      expect(mnemonicToSeed('a b c d e f g h i j k l')).not.toEqual(mnemonicToSeed('l k j i h g f e d c b a'));
    });
  });

  describe('computeSignature', () => {
    it('produces 64-char hex string', () => {
      const key = generateRandomKey();
      const sig = computeSignature('{"test":1}', null, key);
      expect(sig.length).toBe(64);
    });

    it('same inputs produce same signature', () => {
      const key = generateRandomKey();
      expect(computeSignature('x', 'prev', key)).toBe(computeSignature('x', 'prev', key));
    });

    it('different payloads produce different signatures', () => {
      const key = generateRandomKey();
      expect(computeSignature('a', null, key)).not.toBe(computeSignature('b', null, key));
    });

    it('different prevHash produces different signatures', () => {
      const key = generateRandomKey();
      expect(computeSignature('x', 'aaaa', key)).not.toBe(computeSignature('x', 'bbbb', key));
    });

    it('handles empty payload', () => {
      const key = generateRandomKey();
      expect(typeof computeSignature('', null, key)).toBe('string');
    });
  });

  describe('timingSafeCompare', () => {
    it('equal strings match', () => expect(timingSafeCompare('abc', 'abc')).toBe(true));
    it('different strings mismatch', () => expect(timingSafeCompare('abc', 'abd')).toBe(false));
    it('different length mismatch', () => expect(timingSafeCompare('abc', 'abcd')).toBe(false));
    it('Uint8Array comparison', () => {
      expect(timingSafeCompare(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true);
      expect(timingSafeCompare(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false);
    });
  });

  describe('randomBytes', () => {
    it('correct length', () => {
      expect(randomBytes(32).length).toBe(32);
      expect(randomBytes(16).length).toBe(16);
    });

    it('unique outputs', () => {
      const set = new Set<string>();
      for (let i = 0; i < 20; i++) set.add(bytesToHex(randomBytes(32)));
      expect(set.size).toBe(20);
    });
  });
});
