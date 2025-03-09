import { BytesBlob } from "@typeberry/bytes";
// TODO [ToDr] (#212) compare with blake2b from hash-wasm?
import blake2b from "blake2b";

import { type HashAllocator, defaultAllocator } from "./allocator";
import { type Blake2bHash, HASH_SIZE } from "./hash";

/**
 * Hash given collection of blobs.
 *
 * If empty array is given a zero-hash is returned.
 */
export function hashBlobs<H extends Blake2bHash>(
  r: (BytesBlob | Uint8Array)[],
  allocator: HashAllocator = defaultAllocator,
): H {
  const out = allocator.emptyHash();
  if (r.length === 0) {
    return out.asOpaque();
  }

  const hasher = blake2b(HASH_SIZE);
  for (const v of r) {
    hasher?.update(v instanceof BytesBlob ? v.raw : v);
  }
  hasher?.digest(out.raw);
  return out.asOpaque();
}

/** Hash given blob of bytes. */
export function hashBytes(blob: BytesBlob | Uint8Array, allocator: HashAllocator = defaultAllocator): Blake2bHash {
  const hasher = blake2b(HASH_SIZE);
  const bytes = blob instanceof BytesBlob ? blob.raw : blob;
  hasher?.update(bytes);
  const out = allocator.emptyHash();
  hasher?.digest(out.raw);
  return out;
}

/** Convert given string into bytes and hash it. */
export function hashString(str: string, allocator: HashAllocator = defaultAllocator) {
  return hashBytes(BytesBlob.blobFromString(str), allocator);
}
