import { describe, it, expect } from 'vitest';
import { generatePassword, generatePassphrase, calculateEntropy, entropyLabel } from '../password-generator';

describe('generatePassword', () => {
  it('generates correct length', () => {
    expect(generatePassword({ length: 16 }).length).toBe(16);
    expect(generatePassword({ length: 32 }).length).toBe(32);
    expect(generatePassword({ length: 8 }).length).toBe(8);
  });

  it('respects character set options', () => {
    const pwd = generatePassword({ uppercase: true, lowercase: false, digits: false, symbols: false, length: 50 });
    expect(pwd).toMatch(/^[A-Z]+$/);
  });

  it('includes all required character types', () => {
    const pwd = generatePassword({
      uppercase: true,
      lowercase: true,
      digits: true,
      symbols: true,
      length: 50,
    });
    expect(/[A-Z]/.test(pwd)).toBe(true);
    expect(/[a-z]/.test(pwd)).toBe(true);
    expect(/[0-9]/.test(pwd)).toBe(true);
    expect(/[^a-zA-Z0-9]/.test(pwd)).toBe(true);
  });

  it('excludes ambiguous characters when requested', () => {
    const pwd = generatePassword({ excludeAmbiguous: true, length: 100 });
    for (const ch of 'iIl1Lo0O') {
      expect(pwd).not.toContain(ch);
    }
  });

  it('generates different passwords on each call', () => {
    const p1 = generatePassword();
    const p2 = generatePassword();
    expect(p1).not.toBe(p2);
  });

  it('default options produce 20-char password', () => {
    const pwd = generatePassword();
    expect(pwd.length).toBe(20);
  });
});

describe('calculateEntropy', () => {
  it('returns 0 for empty string', () => {
    expect(calculateEntropy('')).toBe(0);
  });

  it('returns higher entropy for longer passwords', () => {
    const short = calculateEntropy('Ab1!');
    const long = calculateEntropy('Ab1!'.repeat(5));
    expect(long).toBeGreaterThan(short);
  });

  it('caps at 128 bits', () => {
    const veryLong = 'A'.repeat(200);
    expect(calculateEntropy(veryLong)).toBeLessThanOrEqual(128);
  });

  it('lowercase-only pool is 26 chars', () => {
    const entropy = calculateEntropy('a' + 'b'.repeat(9)); // 10 chars, pool 26
    expect(entropy).toBe(Math.round(10 * Math.log2(26)));
  });

  it('mixed case + digits + symbols pool is 94 chars', () => {
    const password = 'A' + 'a' + '1' + '!';
    const entropy = calculateEntropy(password);
    expect(entropy).toBe(Math.round(4 * Math.log2(94)));
  });
});

describe('entropyLabel', () => {
  it('classifies low entropy as weak', () => {
    expect(entropyLabel(20)).toBe('weak');
  });

  it('classifies medium entropy as medium', () => {
    expect(entropyLabel(50)).toBe('medium');
  });

  it('classifies high entropy as strong', () => {
    expect(entropyLabel(80)).toBe('strong');
  });

  it('classifies very high entropy as vault-grade', () => {
    expect(entropyLabel(110)).toBe('vault-grade');
  });
});

describe('generatePassphrase', () => {
  it('generates correct number of words', () => {
    expect(generatePassphrase(4, '-').split('-').length).toBe(4);
    expect(generatePassphrase(8, ' ').split(' ').length).toBe(8);
  });

  it('uses custom separator', () => {
    const pp = generatePassphrase(3, '@');
    expect(pp.split('@').length).toBe(3);
  });

  it('produces different passphrases each time', () => {
    const p1 = generatePassphrase(6);
    const p2 = generatePassphrase(6);
    expect(p1).not.toBe(p2);
  });
});
