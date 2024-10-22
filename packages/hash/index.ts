import { Bytes, BytesBlob } from "@typeberry/bytes";
import { check } from "@typeberry/utils";
import blake2b from "blake2b";

/**
 * Size of the output of the hash functions.
 *
 * https://graypaper.fluffylabs.dev/#/387103d/071401071f01
 *
 */
export const HASH_SIZE = 32;
/** A type for the above value. */
export type HASH_SIZE = typeof HASH_SIZE;

/**
 * Opaque, unknown hash.
 */
export type OpaqueHash = Bytes<HASH_SIZE>;

/** Allocator interface - returns an empty bytes vector that can be filled with the hash. */
export interface HashAllocator {
  /** Return a new hash destination. */
  emptyHash(): OpaqueHash;
}

/** The simplest allocator returning just a fresh copy of bytes each time. */
export class SimpleAllocator implements HashAllocator {
  emptyHash(): OpaqueHash {
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

  emptyHash(): OpaqueHash {
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
