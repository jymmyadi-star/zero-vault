/**
 * Tests: lib/crypto/ - BIP39 mnemonic generation
 */
import { describe, it, expect } from 'vitest';
import { generateMnemonic, mnemonicToSeed, validateMnemonic } from '../../lib/crypto/bip39';

describe('BIP39', () => {
  it('generates 24-word mnemonic', () => {
    const m = generateMnemonic();
    const words = m.split(' ');
    expect(words.length).toBe(24);
    words.forEach(w => expect(w.length).toBeGreaterThan(0));
  });

  it('generates unique mnemonics', () => {
    const a = generateMnemonic();
    const b = generateMnemonic();
    expect(a).not.toBe(b);
  });

  it('validates correct mnemonic', () => {
    const m = generateMnemonic();
    expect(validateMnemonic(m)).toBe(true);
  });

  it('rejects invalid mnemonic', () => {
    expect(validateMnemonic('invalid phrase here')).toBe(false);
    expect(validateMnemonic('')).toBe(false);
    expect(validateMnemonic('one two three four five six seven eight nine ten eleven twelve')).toBe(false);
  });

  it('mnemonicToSeed returns 64-byte seed', () => {
    const m = generateMnemonic();
    const seed = mnemonicToSeed(m);
    expect(seed.length).toBe(64);
  });

  it('same mnemonic produces same seed', () => {
    const m = generateMnemonic();
    const s1 = mnemonicToSeed(m);
    const s2 = mnemonicToSeed(m);
    expect(s1).toEqual(s2);
  });

  it('different mnemonics produce different seeds', () => {
    const m1 = generateMnemonic();
    const m2 = generateMnemonic();
    const s1 = mnemonicToSeed(m1);
    const s2 = mnemonicToSeed(m2);
    expect(s1).not.toEqual(s2);
  });
});
