/**
 * Result<T, E> — Rust-style error handling for TypeScript
 *
 * Elimină string matching în try/catch și forțează tratarea erorilor.
 * Patternul: fiecare funcție returnează Result<Succes, Eroare>
 */

export type Result<T, E = Error> = Ok<T> | Err<E>;

export class Ok<T> {
  readonly ok: true = true;
  readonly error: false = false;
  constructor(public readonly value: T) {}
  unwrap(): T { return this.value; }
  unwrapOr(_default: T): T { return this.value; }
  map<U>(fn: (value: T) => U): Result<U> {
    try { return new Ok(fn(this.value)); } catch (e) { return new Err(e as Error); }
  }
  andThen<U>(fn: (value: T) => Result<U>): Result<U> { return fn(this.value); }
  match<U>(handlers: { ok: (value: T) => U; err: (error: unknown) => U }): U { return handlers.ok(this.value); }
}

export class Err<E = Error> {
  readonly ok: false = false;
  readonly error: true = true;
  constructor(public readonly value: E) {}
  unwrap(): never { throw this.value instanceof Error ? this.value : new Error(String(this.value)); }
  unwrapOr<T>(_default: T): T { return _default; }
  map<U>(_fn: (value: never) => U): Result<U, E> { return this as unknown as Result<U, E>; }
  andThen<U>(_fn: (value: never) => Result<U>): Result<U, E> { return this as unknown as Result<U, E>; }
  match<U>(handlers: { ok: (value: unknown) => U; err: (error: E) => U }): U { return handlers.err(this.value); }
}

/** Wraps a sync function that may throw into Result */
export function trySync<T>(fn: () => T): Result<T> {
  try { return new Ok(fn()); } catch (e) { return new Err(e instanceof Error ? e : new Error(String(e))); }
}

/** Wraps an async function that may throw into Result */
export async function tryAsync<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try { return new Ok(await fn()); } catch (e) { return new Err(e instanceof Error ? e : new Error(String(e))); }
}

// ─── Predefined Error Types ───

export enum CryptoErrorCode {
  CSPRNG_UNAVAILABLE = 'CSPRNG_UNAVAILABLE',
  DECRYPT_FAILED = 'DECRYPT_FAILED',
  ENCRYPT_FAILED = 'ENCRYPT_FAILED',
  KEY_DERIVATION_FAILED = 'KEY_DERIVATION_FAILED',
  WRONG_PIN = 'WRONG_PIN',
  VAULT_LOCKED = 'VAULT_LOCKED',
  INVALID_MNEMONIC = 'INVALID_MNEMONIC',
  SEED_CORRUPTED = 'SEED_CORRUPTED',
  BUFFER_DISPOSED = 'BUFFER_DISPOSED',
}

export enum DbErrorCode {
  NOT_INITIALIZED = 'NOT_INITIALIZED',
  CORRUPTED = 'CORRUPTED',
  MIGRATION_FAILED = 'MIGRATION_FAILED',
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',
}

export enum SyncErrorCode {
  HASH_CHAIN_BROKEN = 'HASH_CHAIN_BROKEN',
  KEY_MISSING = 'KEY_MISSING',
  OFFLINE = 'OFFLINE',
  RATE_LIMITED = 'RATE_LIMITED',
  CONFLICT = 'CONFLICT',
}

export enum ValidationErrorCode {
  INVALID_PAYLOAD = 'INVALID_PAYLOAD',
  INVALID_TYPE = 'INVALID_TYPE',
  MISSING_FIELD = 'MISSING_FIELD',
}

export class DomainError extends Error {
  constructor(
    public readonly domain: string,
    public readonly code: string,
    message: string,
    public override readonly cause?: Error,
  ) {
    super(`[${domain}] ${code}: ${message}`);
    this.name = 'DomainError';
  }
}

export function cryptoError(code: CryptoErrorCode, cause?: Error): DomainError {
  return new DomainError('Crypto', code, code, cause);
}

export function dbError(code: DbErrorCode, cause?: Error): DomainError {
  return new DomainError('Database', code, code, cause);
}

export function syncError(code: SyncErrorCode, cause?: Error): DomainError {
  return new DomainError('Sync', code, code, cause);
}

export function validationError(code: ValidationErrorCode, cause?: Error): DomainError {
  return new DomainError('Validation', code, code, cause);
}
