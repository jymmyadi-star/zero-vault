import { describe, it, expect } from 'vitest';
import { generateMnemonic, mnemonicToSeed, validateMnemonic } from '../bip39';
import { BIP39_WORDS } from '../bip39-words';
import { bytesToHex } from '../crypto-utils';

describe('generateMnemonic', () => {
  it('generates 24 words', () => {
    const mnemonic = generateMnemonic();
    const words = mnemonic.split(' ');
    expect(words.length).toBe(24);
  });

  it('all words are valid BIP39', () => {
    const mnemonic = generateMnemonic();
    const words = mnemonic.split(' ');
    for (const word of words) {
      expect(BIP39_WORDS).toContain(word);
    }
  });

  it('generates different mnemonics each time', () => {
    const m1 = generateMnemonic();
    const m2 = generateMnemonic();
    expect(m1).not.toBe(m2);
  });

  it('passes validation', () => {
    for (let i = 0; i < 5; i++) {
      expect(validateMnemonic(generateMnemonic())).toBe(true);
    }
  });
});

describe('validateMnemonic', () => {
  it('rejects empty string', () => {
    expect(validateMnemonic('')).toBe(false);
  });

  it('rejects wrong number of words', () => {
    expect(validateMnemonic('abandon ability')).toBe(false);
  });

  it('rejects invalid words', () => {
    const bad = 'xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx';
    expect(validateMnemonic(bad)).toBe(false);
  });

  it('accepts valid 24-word phrase', () => {
    const mnemonic = generateMnemonic();
    expect(validateMnemonic(mnemonic)).toBe(true);
  });

  it('accepts with extra whitespace', () => {
    const m = generateMnemonic();
    expect(validateMnemonic('  ' + m + '  ')).toBe(true);
  });

  it('accepts mixed case', () => {
    const m = generateMnemonic().toUpperCase();
    expect(validateMnemonic(m)).toBe(true);
  });
});

describe('mnemonicToSeed', () => {
  it('produces 64-byte seed', () => {
    const mnemonic = generateMnemonic();
    const seed = mnemonicToSeed(mnemonic);
    expect(seed.length).toBe(64);
  });

  it('is deterministic', () => {
    const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art';
    expect(validateMnemonic(mnemonic)).toBe(true);
    const s1 = mnemonicToSeed(mnemonic);
    const s2 = mnemonicToSeed(mnemonic);
    expect(bytesToHex(s1)).toBe(bytesToHex(s2));
  });

  it('different passphrase produces different seed', () => {
    const mnemonic = generateMnemonic();
    const s1 = mnemonicToSeed(mnemonic, 'secret1');
    const s2 = mnemonicToSeed(mnemonic, 'secret2');
    expect(bytesToHex(s1)).not.toBe(bytesToHex(s2));
  });

  it('same passphrase produces same seed', () => {
    const mnemonic = generateMnemonic();
    const s1 = mnemonicToSeed(mnemonic, 'my-passphrase');
    const s2 = mnemonicToSeed(mnemonic, 'my-passphrase');
    expect(bytesToHex(s1)).toBe(bytesToHex(s2));
  });

  it('trims and normalizes whitespace', () => {
    const m = generateMnemonic();
    const words = m.split(' ');
    const messy = words.map((w, i) => (i % 3 === 0 ? '  ' + w : (i % 3 === 1 ? w + '  ' : ' ' + w + ' '))).join(' ');
    const s1 = mnemonicToSeed(m);
    const s2 = mnemonicToSeed(messy);
    expect(bytesToHex(s1)).toBe(bytesToHex(s2));
  });
});
