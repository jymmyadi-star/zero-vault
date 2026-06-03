import { BIP39_WORDS } from './bip39-words';
import { randomBytes } from './crypto-utils';
import { sha256, sha512 } from '@noble/hashes/sha2.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';

const MNEMONIC_ENTROPY_BITS = 256;
const MNEMONIC_WORD_COUNT = 24;
const PBKDF2_ITERATIONS = 2048;
const PBKDF2_KEYLEN = 64;

function entropyToMnemonic(entropy: Uint8Array): string {
  const entropyBits = entropy.length * 8;
  const checksumBits = entropyBits / 32;
  const hash = sha256(entropy);
  const checksum = hash[0]!;

  const bits: number[] = [];
  for (let i = 0; i < entropy.length; i++) {
    for (let j = 7; j >= 0; j--) {
      bits.push((entropy[i]! >> j) & 1);
    }
  }
  for (let j = 7; j >= 8 - checksumBits; j--) {
    bits.push((checksum >> j) & 1);
  }

  const words: string[] = [];
  for (let i = 0; i < bits.length; i += 11) {
    let index = 0;
    for (let j = 0; j < 11; j++) {
      index = (index << 1) | (bits[i + j] ?? 0);
    }
    words.push(BIP39_WORDS[index]!);
  }

  return words.join(' ');
}

function mnemonicToEntropy(mnemonic: string): { entropy: Uint8Array; checksumValid: boolean } {
  const words = mnemonic.trim().toLowerCase().split(/\s+/);
  if (words.length !== MNEMONIC_WORD_COUNT) {
    throw new Error(`Invalid mnemonic: expected ${MNEMONIC_WORD_COUNT} words, got ${words.length}`);
  }

  const indices = words.map((word) => {
    const idx = BIP39_WORDS.indexOf(word);
    if (idx === -1) throw new Error(`Invalid mnemonic word: "${word}"`);
    return idx;
  });

  const totalBits = indices.length * 11;
  const entropyBits = (totalBits * 32) / 33;
  const checksumBits = totalBits - entropyBits;

  const bits: number[] = [];
  for (const idx of indices) {
    for (let j = 10; j >= 0; j--) {
      bits.push((idx >> j) & 1);
    }
  }

  const entropy = new Uint8Array(entropyBits / 8);
  for (let i = 0; i < entropyBits; i++) {
    if (bits[i] === 1) {
      entropy[Math.floor(i / 8)]! |= 1 << (7 - (i % 8));
    }
  }

  let checksumValue = 0;
  for (let i = entropyBits; i < totalBits; i++) {
    checksumValue = (checksumValue << 1) | (bits[i] ?? 0);
  }

  const hash = sha256(entropy);
  const expectedChecksum = hash[0]! >> (8 - checksumBits);

  return { entropy, checksumValid: checksumValue === expectedChecksum };
}

export function generateMnemonic(): string {
  const entropy = randomBytes(MNEMONIC_ENTROPY_BITS / 8);
  return entropyToMnemonic(entropy);
}

export function validateMnemonic(mnemonic: string): boolean {
  try {
    const result = mnemonicToEntropy(mnemonic);
    return result.checksumValid;
  } catch {
    return false;
  }
}

export function mnemonicToSeed(mnemonic: string, passphrase: string = ''): Uint8Array {
  mnemonic = mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');
  const salt = 'mnemonic' + passphrase;
  const passwordBytes = new TextEncoder().encode(mnemonic);
  const saltBytes = new TextEncoder().encode(salt);
  return pbkdf2(sha512, passwordBytes, saltBytes, { c: PBKDF2_ITERATIONS, dkLen: PBKDF2_KEYLEN });
}
