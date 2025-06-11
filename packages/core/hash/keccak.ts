import { Bytes, type BytesBlob } from "@typeberry/bytes";
import { type IHasher, createKeccak } from "hash-wasm";
import { HASH_SIZE } from "./hash.js";

export class KeccakHasher {
  static async create(): Promise<KeccakHasher> {
    return new KeccakHasher(await createKeccak(256));
  }

  private constructor(public readonly hasher: IHasher) {}
}

export function hashBlobs(hasher: KeccakHasher, blobs: BytesBlob[]) {
  hasher.hasher.init();
  for (const blob of blobs) {
    hasher.hasher.update(blob.raw);
  }
  // NOTE we can't use an allocator here because the library does not allow that.
  return Bytes.fromBlob(hasher.hasher.digest("binary"), HASH_SIZE);
}
