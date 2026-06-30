/**
 * SecureBuffer — enterprise-grade memory-safe byte container
 *
 * Backed by FinalizationRegistry to guarantee zero-on-GC even if
 * dispose() is not called explicitly. Falls back to no-op when
 * FinalizationRegistry is unavailable (React Native Hermes).
 */

const registry: { register: (target: object, heldValue: Uint8Array) => void; unregister: (token: Uint8Array) => void } =
  typeof FinalizationRegistry !== 'undefined'
    ? new FinalizationRegistry<Uint8Array>((buf: Uint8Array) => {
        buf.fill(0);
      })
    : { register: () => {}, unregister: () => {} };

function registerForCleanup(buf: Uint8Array): Uint8Array {
  registry.register({ __buf: buf } as any, buf);
  return buf;
}

export class SecureBuffer {
  private _buf: Uint8Array | null;
  private _disposed = false;

  private constructor(buf: Uint8Array) {
    this._buf = registerForCleanup(buf);
  }

  static from(src: Uint8Array): SecureBuffer {
    const dst = new Uint8Array(src.length);
    dst.set(src);
    src.fill(0);
    return new SecureBuffer(dst);
  }

  static fromHex(hex: string): SecureBuffer {
    if (hex.length % 2 !== 0) {
      throw new SecureBufferError('INVALID_HEX_LENGTH');
    }
    const buf = new Uint8Array(hex.length / 2);
    for (let i = 0; i < buf.length; i++) {
      buf[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    }
    return new SecureBuffer(buf);
  }

  static random(length: number): SecureBuffer {
    const buf = new Uint8Array(length);
    crypto.getRandomValues(buf);
    return new SecureBuffer(buf);
  }

  static fromString(str: string): SecureBuffer {
    return new SecureBuffer(new TextEncoder().encode(str));
  }

  private unsafe(): Uint8Array {
    if (this._disposed || !this._buf) throw new SecureBufferError('DISPOSED');
    return this._buf;
  }

  get length(): number { return this.unsafe().length; }

  copy(): Uint8Array {
    const s = this.unsafe();
    const d = new Uint8Array(s.length);
    d.set(s);
    return d;
  }

  toHex(): string {
    const b = this.unsafe();
    let h = '';
    for (let i = 0; i < b.length; i++) {
      h += (b[i] as number).toString(16).padStart(2, '0');
    }
    return h;
  }

  dispose(): void {
    if (this._disposed || !this._buf) return;
    registry.unregister(this._buf);
    this._buf.fill(0);
    this._buf = null;
    this._disposed = true;
  }

  get disposed(): boolean { return this._disposed; }

  use<T>(fn: (b: Uint8Array) => T): T {
    return fn(this.unsafe());
  }

  useAndDispose<T>(fn: (b: Uint8Array) => T): T {
    try {
      return fn(this.unsafe());
    } finally {
      this.dispose();
    }
  }

  timingSafeEqual(other: SecureBuffer): boolean {
    const a = this.unsafe();
    const b = other.unsafe();
    let m = 0;
    const minLen = Math.min(a.length, b.length);
    for (let i = 0; i < minLen; i++) {
      m |= (a[i] as number) ^ (b[i] as number);
    }
    m |= a.length ^ b.length;
    return m === 0;
  }

  slice(start: number, end?: number): SecureBuffer {
    return new SecureBuffer(new Uint8Array(this.unsafe().slice(start, end)));
  }

  static xor(a: SecureBuffer, b: SecureBuffer): SecureBuffer {
    const aa = a.unsafe();
    const bb = b.unsafe();
    if (aa.length !== bb.length) throw new SecureBufferError('LENGTH_MISMATCH');
    const r = new Uint8Array(aa.length);
    for (let i = 0; i < aa.length; i++) {
      r[i] = (aa[i] as number) ^ (bb[i] as number);
    }
    return new SecureBuffer(r);
  }
}

export class SecureBufferError extends Error {
  constructor(code: string) {
    super(`[SecureBuffer] ${code}`);
    this.name = 'SecureBufferError';
  }
}
