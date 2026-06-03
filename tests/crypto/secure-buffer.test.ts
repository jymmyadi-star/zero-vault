/**
 * Tests: lib/crypto/secure-buffer.ts
 * Validates memory-safe byte container: zero-on-dispose, timing-safe compare, XOR, slice, hex
 */
import { describe, it, expect } from 'vitest';
import { SecureBuffer, SecureBufferError } from '../../lib/crypto/secure-buffer';

describe('SecureBuffer', () => {
  it('creates from Uint8Array', () => {
    const src = new Uint8Array([1, 2, 3]);
    const sb = SecureBuffer.from(src);
    expect(sb.length).toBe(3);
    expect(src.every(b => b === 0)).toBe(true); // source is zeroed
    sb.dispose();
  });

  it('creates from hex', () => {
    const sb = SecureBuffer.fromHex('aabbcc');
    expect(sb.toHex()).toBe('aabbcc');
    sb.dispose();
  });

  it('creates random bytes', () => {
    const a = SecureBuffer.random(32);
    const b = SecureBuffer.random(32);
    expect(a.toHex()).not.toBe(b.toHex());
    a.dispose(); b.dispose();
  });

  it('creates from string', () => {
    const sb = SecureBuffer.fromString('hello');
    expect(sb.length).toBe(5);
    sb.dispose();
  });

  it('copy returns identical data', () => {
    const sb = SecureBuffer.fromHex('deadbeef');
    const copy = sb.copy();
    expect(copy).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
    copy.fill(0);
    sb.dispose();
  });

  it('toHex roundtrip', () => {
    const sb = SecureBuffer.fromHex('0123456789abcdef');
    expect(sb.toHex()).toBe('0123456789abcdef');
    sb.dispose();
  });

  it('disposes correctly', () => {
    const sb = SecureBuffer.random(16);
    expect(sb.disposed).toBe(false);
    sb.dispose();
    expect(sb.disposed).toBe(true);
    expect(() => sb.copy()).toThrow(SecureBufferError);
  });

  it('throws on use after dispose', () => {
    const sb = SecureBuffer.random(8);
    sb.dispose();
    expect(() => sb.toHex()).toThrow(SecureBufferError);
    expect(() => sb.copy()).toThrow(SecureBufferError);
  });

  it('timingSafeEqual works', () => {
    const a = SecureBuffer.fromHex('abcdef');
    const b = SecureBuffer.fromHex('abcdef');
    const c = SecureBuffer.fromHex('000000');
    expect(a.timingSafeEqual(b)).toBe(true);
    expect(a.timingSafeEqual(c)).toBe(false);
    a.dispose(); b.dispose(); c.dispose();
  });

  it('timingSafeEqual rejects different lengths', () => {
    const a = SecureBuffer.random(8);
    const b = SecureBuffer.random(16);
    expect(a.timingSafeEqual(b)).toBe(false);
    a.dispose(); b.dispose();
  });

  it('slice works', () => {
    const sb = SecureBuffer.fromHex('00112233');
    const s = sb.slice(2);
    expect(s.toHex()).toBe('2233');
    sb.dispose(); s.dispose();
  });

  it('XOR works', () => {
    const a = SecureBuffer.fromHex('ffff');
    const b = SecureBuffer.fromHex('0f0f');
    const r = SecureBuffer.xor(a, b);
    expect(r.toHex()).toBe('f0f0');
    a.dispose(); b.dispose(); r.dispose();
  });

  it('XOR rejects length mismatch', () => {
    const a = SecureBuffer.random(8);
    const b = SecureBuffer.random(4);
    expect(() => SecureBuffer.xor(a, b)).toThrow(SecureBufferError);
    a.dispose(); b.dispose();
  });

  it('use passes buffer to callback', () => {
    const sb = SecureBuffer.random(16);
    let called = false;
    sb.use(buf => {
      expect(buf.length).toBe(16);
      called = true;
    });
    expect(called).toBe(true);
    sb.dispose();
  });

  it('useAndDispose calls dispose after callback', () => {
    const sb = SecureBuffer.random(8);
    sb.useAndDispose(() => {});
    expect(sb.disposed).toBe(true);
  });

  it('dispose is idempotent', () => {
    const sb = SecureBuffer.random(8);
    sb.dispose();
    sb.dispose();
    expect(sb.disposed).toBe(true);
  });

  it('handles empty buffer', () => {
    const sb = SecureBuffer.from(new Uint8Array(0));
    expect(sb.length).toBe(0);
    expect(sb.toHex()).toBe('');
    sb.dispose();
  });

  it('from zeroes source', () => {
    const src = new Uint8Array([1, 2, 3, 4]);
    const sb = SecureBuffer.from(src);
    expect(src[0]).toBe(0);
    expect(src[1]).toBe(0);
    sb.dispose();
  });
});
