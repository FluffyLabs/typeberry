import { BytesBlob } from "@typeberry/bytes";
import type { Blake2b } from "@typeberry/hash";
import { hashBlobs, type KeccakHasher } from "@typeberry/hash/keccak.js";
import type { TrieNodeHash } from "./nodes.js";
import type { TrieHasher } from "./nodesDb.js";

export function getBlake2bTrieHasher(hasher: Blake2b): TrieHasher {
  return {
    hashConcat(n: Uint8Array, rest: Uint8Array[] = []): TrieNodeHash {
      return hasher.hashBlobs([n, ...rest]);
    },
  };
}

export function getKeccakTrieHasher(hasher: KeccakHasher): TrieHasher {
  return {
    hashConcat(n: Uint8Array, rest: Uint8Array[] = []): TrieNodeHash {
      return hashBlobs(hasher, [n, ...rest].map(BytesBlob.blobFrom)).asOpaque();
    },
  };
}
