import { HASH_SIZE } from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { check } from "@typeberry/utils";
import blake2b from "blake2b";

/** Allocator interface - returns an empty bytes vector that can be filled with the hash. */
export interface HashAllocator {
  /** Return a new hash destination. */
  emptyHash(): Bytes<typeof HASH_SIZE>;
}

/** The simplest allocator returning just a fresh copy of bytes each time. */
export class SimpleAllocator implements HashAllocator {
  emptyHash(): Bytes<typeof HASH_SIZE> {
    return Bytes.zero(HASH_SIZE);
  }
}

/** An allocator that works by allocating larger (continuous) pages of memory. */
export class PageAllocator implements HashAllocator {
  private page: Uint8Array = new Uint8Array(0);
  private currentHash = 0;

  // TODO [ToDr] Benchmark the performance!
  constructor(private readonly hashesPerPage: number) {
    check(hashesPerPage > 0 && hashesPerPage >>> 0 === hashesPerPage, "Expected a non-zero integer.");
    this.resetPage();
  }

  private resetPage() {
    const pageSizeBytes = this.hashesPerPage * HASH_SIZE;
    this.currentHash = 0;
    this.page = new Uint8Array(pageSizeBytes);
  }

  emptyHash(): Bytes<typeof HASH_SIZE> {
    const startIdx = this.currentHash * HASH_SIZE;
    const endIdx = startIdx + HASH_SIZE;

    this.currentHash += 1;
    if (this.currentHash >= this.hashesPerPage) {
      this.resetPage();
    }

    return Bytes.fromBlob(this.page.subarray(startIdx, endIdx), HASH_SIZE);
  }
}

export const defaultAllocator = new SimpleAllocator();

/** Blob of bytes with a lazy-evaluated hash. */
export class HashableBlob<THash extends Bytes<typeof HASH_SIZE> = Bytes<typeof HASH_SIZE>> {
  constructor(
    public readonly blob: BytesBlob,
    private hash?: THash,
    private allocator: HashAllocator = defaultAllocator,
  ) {}

  /** Get or compute the hash of the data. */
  getHash(): THash {
    if (this.hash) {
      return this.hash;
    }

    this.hash = hashBytes(this.blob, this.allocator) as THash;
    return this.hash;
  }
}

/** Hash given blob of bytes. */
export function hashBytes(blob: BytesBlob, allocator: HashAllocator = defaultAllocator) {
  const hasher = blake2b(HASH_SIZE);
  hasher?.update(blob.buffer);
  const out = allocator.emptyHash();
  hasher?.digest(out.raw);
  return out;
}

export function hashString(str: string, allocator: HashAllocator = defaultAllocator) {
  return hashBytes(BytesBlob.fromString(str), allocator);
}
