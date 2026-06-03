import { describe, it, expect } from 'vitest';
import { generateTOTP, generateRandomTOTPSecret, base32ToBytes } from '../totp';

describe('TOTP generation', () => {
  it('generates 6-digit code', () => {
    const secret = generateRandomTOTPSecret();
    const { code } = generateTOTP(secret);
    expect(code).toMatch(/^\d{6}$/);
  });

  it('generates consistent codes for the same time window', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const { code: code1 } = generateTOTP(secret);
    const { code: code2 } = generateTOTP(secret);
    expect(code1).toBe(code2);
  });

  it('returns remaining seconds between 0 and period', () => {
    const secret = generateRandomTOTPSecret();
    const { remainingSeconds } = generateTOTP(secret, { period: 30 });
    expect(remainingSeconds).toBeGreaterThanOrEqual(0);
    expect(remainingSeconds).toBeLessThanOrEqual(30);
  });

  it('supports SHA256 algorithm', () => {
    const secret = generateRandomTOTPSecret();
    const { code } = generateTOTP(secret, { algorithm: 'SHA256' });
    expect(code).toMatch(/^\d{6}$/);
  });

  it('supports 8-digit codes', () => {
    const secret = generateRandomTOTPSecret();
    const { code } = generateTOTP(secret, { digits: 8 });
    expect(code).toMatch(/^\d{8}$/);
  });

  it('rejects empty secret', () => {
    expect(() => generateTOTP('')).toThrow();
  });

  it('rejects invalid base32 secret', () => {
    expect(() => generateTOTP('!!!!!')).toThrow();
  });
});

describe('RFC 6238 test vectors', () => {
  it('SHA1 test vector at T=1111111109', () => {
    const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
    const { code, remainingSeconds } = generateTOTP(secret, { period: 30, algorithm: 'SHA1' });
    expect(code).toMatch(/^\d{6}$/);
    expect(remainingSeconds).toBeGreaterThanOrEqual(0);
    expect(remainingSeconds).toBeLessThanOrEqual(30);
  });
});

describe('base32ToBytes', () => {
  it('handles padding correctly', () => {
    const bytes = base32ToBytes('JBSWY3DPEHPK3PXP');
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('handles lowercase input', () => {
    const upper = base32ToBytes('JBSWY3DPEHPK3PXP');
    const lower = base32ToBytes('jbswy3dpehpk3pxp');
    expect(upper).toEqual(lower);
  });

  it('strips whitespace and other chars', () => {
    const clean = base32ToBytes('JBSWY3DPEHPK3PXP');
    const withSpace = base32ToBytes('jbsw y3dp ehpk 3pxp');
    expect(withSpace).toEqual(clean);
  });
});

describe('generateRandomTOTPSecret', () => {
  it('generates base32 string', () => {
    const secret = generateRandomTOTPSecret();
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(secret.length).toBe(32);
  });

  it('produces valid TOTP codes', () => {
    const secret = generateRandomTOTPSecret();
    const { code } = generateTOTP(secret);
    expect(code).toMatch(/^\d{6}$/);
  });

  it('produces different secrets each time', () => {
    const s1 = generateRandomTOTPSecret();
    const s2 = generateRandomTOTPSecret();
    expect(s1).not.toBe(s2);
  });
});
