import { hashConcat } from "@typeberry/blake2b";
import type { TrieHash } from "./nodes";
import type { TrieHasher } from "./nodesDb";

export const blake2bTrieHasher: TrieHasher = {
  hashConcat(n: Uint8Array, rest?: Uint8Array[]): TrieHash {
    return hashConcat(n, rest);
  },
};
