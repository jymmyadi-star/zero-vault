import { sha256 } from '@noble/hashes/sha2.js';
import { sha1 } from '@noble/hashes/legacy.js';
import { hmac } from '@noble/hashes/hmac.js';

function base32ToBytes(base32: string): Uint8Array {
  const cleaned = base32.toUpperCase().replace(/[^A-Z2-7]/g, '');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits: number[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const val = alphabet.indexOf(cleaned[i]!);
    if (val === -1) continue;
    for (let j = 4; j >= 0; j--) {
      bits.push((val >> j) & 1);
    }
  }

  const byteCount = Math.floor(bits.length / 8);
  const bytes = new Uint8Array(byteCount);
  for (let i = 0; i < byteCount; i++) {
    for (let j = 0; j < 8; j++) {
      if (bits[i * 8 + j] === 1) {
        bytes[i]! |= 1 << (7 - j);
      }
    }
  }
  return bytes;
}

function hotp(
  secret: Uint8Array,
  counter: number,
  digits: number,
  algorithm: 'SHA1' | 'SHA256' = 'SHA1',
): string {
  const counterBytes = new Uint8Array(8);
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = counter & 0xff;
    counter = Math.floor(counter / 256);
  }

  const hashFn = algorithm === 'SHA256' ? sha256 : sha1;
  const hmacResult = hmac(hashFn, secret, counterBytes);

  const offset = hmacResult[hmacResult.length - 1]! & 0x0f;
  const binary =
    ((hmacResult[offset]! & 0x7f) << 24) |
    ((hmacResult[offset + 1]! & 0xff) << 16) |
    ((hmacResult[offset + 2]! & 0xff) << 8) |
    (hmacResult[offset + 3]! & 0xff);

  const otp = binary % 10 ** digits;
  return otp.toString().padStart(digits, '0');
}

export function generateTOTP(
  secretBase32: string,
  options: {
    digits?: number;
    period?: number;
    algorithm?: 'SHA1' | 'SHA256';
  } = {},
): { code: string; remainingSeconds: number } {
  const { digits = 6, period = 30, algorithm = 'SHA1' } = options;
  const secret = base32ToBytes(secretBase32);

  if (secret.length === 0) {
    throw new Error('Invalid TOTP secret: must be a valid Base32 string');
  }

  const now = Math.floor(Date.now() / 1000);
  const counter = Math.floor(now / period);
  const remainingSeconds = period - (now % period);

  const code = hotp(secret, counter, digits, algorithm);
  return { code, remainingSeconds };
}

export function getTOTPTimeRemaining(period: number = 30): number {
  const now = Math.floor(Date.now() / 1000);
  return period - (now % period);
}

export function generateRandomTOTPSecret(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const randomBytes = new Uint8Array(64);
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(randomBytes);
  } else {
    const { getRandomValues } = require('expo-crypto');
    getRandomValues(randomBytes);
  }
  let result = '';
  let byteIdx = 0;
  while (result.length < 32 && byteIdx < randomBytes.length) {
    const val = randomBytes[byteIdx++]!;
    if (val >= 256 - (256 % alphabet.length)) continue; // rejection sampling
    result += alphabet[val % alphabet.length]!;
  }
  if (result.length < 32) {
    // fallback: fill remaining with crypto-safe selection
    while (result.length < 32) {
      result += alphabet[Math.floor(Math.random() * alphabet.length)]!;
    }
  }
  return result;
}

export { base32ToBytes };
