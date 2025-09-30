import { Bytes, BytesBlob } from "@typeberry/bytes";
import { createBLAKE2b, IHasher } from "hash-wasm";

import { type Blake2bHash, HASH_SIZE } from "./hash.js";

const zero = Bytes.zero(HASH_SIZE);

export class Blake2b {
  static async createHasher()  {
    return new Blake2b(await createBLAKE2b(HASH_SIZE * 8));
  }

  private constructor(
    private readonly hasher: IHasher,
  ) {}

  /**
   * Hash given collection of blobs.
   *
   * If empty array is given a zero-hash is returned.
   */
  hashBlobs<H extends Blake2bHash>(
    r: (BytesBlob | Uint8Array)[],
  ): H {
    if (r.length === 0) {
      return zero.asOpaque();
    }

    const hasher = this.hasher.init();
    for (const v of r) {
      hasher.update(v instanceof BytesBlob ? v.raw : v);
    }
    return Bytes.fromBlob(hasher?.digest("binary"), HASH_SIZE).asOpaque()
  }

  /** Hash given blob of bytes. */
  hashBytes(blob: BytesBlob | Uint8Array): Blake2bHash {
    const hasher = this.hasher.init();
    const bytes = blob instanceof BytesBlob ? blob.raw : blob;
    hasher.update(bytes);
    return Bytes.fromBlob(hasher?.digest("binary"), HASH_SIZE).asOpaque()
  }

  /** Convert given string into bytes and hash it. */
  hashString(str: string) {
    return this.hashBytes(BytesBlob.blobFromString(str));
  }
}
