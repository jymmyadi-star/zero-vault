/**
 * Tests: lib/result.ts
 * Validates Result<T,E> pattern, trySync, tryAsync, DomainError, error codes
 */
import { describe, it, expect } from 'vitest';
import {
  Ok, Err, trySync, tryAsync,
  DomainError, cryptoError, dbError, syncError, validationError,
  CryptoErrorCode, DbErrorCode, SyncErrorCode, ValidationErrorCode,
} from '../lib/result';

describe('Result<T,E>', () => {
  it('Ok wraps values', () => {
    const r = new Ok(42);
    expect(r.ok).toBe(true);
    expect(r.error).toBe(false);
    expect(r.unwrap()).toBe(42);
  });

  it('Ok.unwrapOr returns value', () => {
    expect(new Ok(10).unwrapOr(99)).toBe(10);
  });

  it('Err wraps errors', () => {
    const r = new Err(new Error('fail'));
    expect(r.ok).toBe(false);
    expect(r.error).toBe(true);
    expect(r.unwrapOr(42)).toBe(42);
  });

  it('Err.unwrap throws', () => {
    expect(() => new Err(new Error('boom')).unwrap()).toThrow('boom');
  });

  it('Ok.map transforms value', () => {
    const r = new Ok(5).map(x => x * 2);
    expect(r.unwrap()).toBe(10);
  });

  it('Err.map preserves error', () => {
    const r = new Err(new Error('no'));
    expect(r.map(() => 1).unwrapOr(99)).toBe(99);
  });

  it('Ok.match calls ok handler', () => {
    const result = new Ok(7).match({ ok: v => v * 3, err: () => 0 });
    expect(result).toBe(21);
  });

  it('Err.match calls err handler', () => {
    const result = new Err(new Error('no')).match({ ok: () => 0, err: () => -1 });
    expect(result).toBe(-1);
  });

  it('Ok.andThen chains successes', () => {
    const r = new Ok(5).andThen(v => new Ok(v + 10));
    expect(r.unwrap()).toBe(15);
  });

  it('Ok.andThen short-circuits on error', () => {
    const r = new Ok(5).andThen(() => new Err(new Error('broken')));
    expect(r.ok).toBe(false);
  });
});

describe('trySync', () => {
  it('returns Ok for successful functions', () => {
    const r = trySync(() => 42);
    expect(r.unwrap()).toBe(42);
  });

  it('returns Err for thrown errors', () => {
    const r = trySync(() => { throw new Error('fail'); });
    expect(r.ok).toBe(false);
  });
});

describe('tryAsync', () => {
  it('returns Ok for resolved promises', async () => {
    const r = await tryAsync(() => Promise.resolve('ok'));
    expect(r.unwrap()).toBe('ok');
  });

  it('returns Err for rejected promises', async () => {
    const r = await tryAsync(() => Promise.reject(new Error('fail')));
    expect(r.ok).toBe(false);
  });
});

describe('DomainError', () => {
  it('creates crypto errors with correct code', () => {
    const e = cryptoError(CryptoErrorCode.DECRYPT_FAILED);
    expect(e.domain).toBe('Crypto');
    expect(e.code).toBe(CryptoErrorCode.DECRYPT_FAILED);
  });

  it('creates db errors with correct code', () => {
    const e = dbError(DbErrorCode.CORRUPTED);
    expect(e.domain).toBe('Database');
    expect(e.code).toBe(DbErrorCode.CORRUPTED);
  });

  it('creates sync errors with correct code', () => {
    const e = syncError(SyncErrorCode.HASH_CHAIN_BROKEN);
    expect(e.domain).toBe('Sync');
  });

  it('creates validation errors with correct code', () => {
    const e = validationError(ValidationErrorCode.INVALID_PAYLOAD);
    expect(e.domain).toBe('Validation');
  });

  it('supports cause chaining', () => {
    const cause = new Error('root');
    const e = cryptoError(CryptoErrorCode.WRONG_PIN, cause);
    expect(e.cause).toBe(cause);
  });
});
