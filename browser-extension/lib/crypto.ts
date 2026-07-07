import { sha256 } from '@noble/hashes/sha2.js';
import { BIP39_WORDS } from '../../lib/crypto/bip39-words';
import {
  randomBytes,
  mnemonicToSeed as sharedMnemonicToSeed,
} from '../../lib/crypto/shared-primitives';

export {
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
  derivePairingId,
  deriveDeviceCredentials,
  computeSignature,
  timingSafeCompare,
  type WrappedKey,
  type EncryptedEnvelope,
} from '../../lib/crypto/shared-primitives';

export function mnemonicToSeed(mnemonic: string): Uint8Array {
  return sharedMnemonicToSeed(mnemonic);
}

const MNEMONIC_ENTROPY_BITS = 256;
const MNEMONIC_CHECKSUM_BITS = MNEMONIC_ENTROPY_BITS / 32;

export function generateMnemonic(): string {
  const entropy = randomBytes(MNEMONIC_ENTROPY_BITS / 8);
  const hash = sha256(entropy);
  const checksumByte = hash[0]!;

  const bits: number[] = [];
  for (let i = 0; i < entropy.length; i++) {
    for (let j = 7; j >= 0; j--) {
      bits.push((entropy[i]! >> j) & 1);
    }
  }
  for (let j = 7; j >= 8 - MNEMONIC_CHECKSUM_BITS; j--) {
    bits.push((checksumByte >> j) & 1);
  }

  const words: string[] = [];
  for (let i = 0; i < bits.length; i += 11) {
    let index = 0;
    for (let j = 0; j < 11; j++) {
      index = (index << 1) | (bits[i + j] ?? 0);
    }
    words.push(BIP39_WORDS[index]!);
  }

  entropy.fill(0);
  return words.join(' ');
}

export function validateMnemonic(mnemonic: string): boolean {
  try {
    const words = mnemonic.trim().toLowerCase().split(/\s+/);
    if (words.length !== 24) return false;

    const indices = words.map((word) => {
      const idx = BIP39_WORDS.indexOf(word);
      if (idx === -1) throw new Error(`Invalid word: "${word}"`);
      return idx;
    });

    const totalBits = indices.length * 11;
    const entropyBits = (totalBits * 32) / 33;

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
    const expectedChecksum = hash[0]! >> (8 - (totalBits - entropyBits));
    entropy.fill(0);

    return checksumValue === expectedChecksum;
  } catch {
    return false;
  }
}
