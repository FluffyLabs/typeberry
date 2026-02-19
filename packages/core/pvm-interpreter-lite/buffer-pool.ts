const PAGE_SIZE = 4096;

/**
 * Pool for recycling 4KB Uint8Array buffers used by writeable pages.
 *
 * Avoids repeated allocation + GC pressure during sbrk() and reset() cycles.
 * Acquired buffers are always zeroed before returning.
 */
export class BufferPool {
  private pool: Uint8Array[] = [];

  /** Get a zeroed 4KB buffer - from pool or newly allocated. */
  acquire(): Uint8Array {
    const buf = this.pool.pop();
    if (buf !== undefined) {
      buf.fill(0); // ~200ns for 4KB - faster than new ArrayBuffer + GC
      return buf;
    }
    return new Uint8Array(PAGE_SIZE); // new = already zeroed by runtime
  }

  /** Return buffer to pool for reuse. */
  release(buf: Uint8Array): void {
    this.pool.push(buf);
  }
}
