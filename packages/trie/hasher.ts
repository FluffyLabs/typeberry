import { blake2b } from "@typeberry/hash";
import type { TrieHash } from "./nodes";
import type { TrieHasher } from "./nodesDb";

export const blake2bTrieHasher: TrieHasher = {
  hashConcat(n: Uint8Array, rest: Uint8Array[] = []): TrieHash {
    return blake2b.hashBlobs([n, ...rest]);
  },
};
