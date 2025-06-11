import { BytesBlob } from "@typeberry/bytes";
import { blake2b } from "@typeberry/hash";
import { type KeccakHasher, hashBlobs } from "@typeberry/hash/keccak.js";
import type { TrieHash } from "./nodes.js";
import type { TrieHasher } from "./nodesDb.js";

export const blake2bTrieHasher: TrieHasher = {
  hashConcat(n: Uint8Array, rest: Uint8Array[] = []): TrieHash {
    return blake2b.hashBlobs([n, ...rest]);
  },
};

export function getKeccakTrieHasher(hasher: KeccakHasher): TrieHasher {
  return {
    hashConcat(n: Uint8Array, rest: Uint8Array[] = []): TrieHash {
      return hashBlobs(hasher, [n, ...rest].map(BytesBlob.blobFrom)).asOpaque();
    },
  };
}
