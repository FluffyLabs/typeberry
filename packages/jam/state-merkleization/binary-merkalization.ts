import { Bytes, BytesBlob } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import type { TrieHasher, TrieNodeHash } from "@typeberry/trie";

/**
 *. Binary merkleization for well-balanced trees.
 *
 * https://graypaper.fluffylabs.dev/#/38c4e62/3c5d033c5d03?v=0.7.0
 */
export function binaryMerkleization(input: BytesBlob[], hasher: TrieHasher): TrieNodeHash {
  if (input.length === 1) {
    return hasher.hashConcat(input[0].raw);
  }

  function upperN(input: BytesBlob[], hasher: TrieHasher): BytesBlob | TrieNodeHash {
    if (input.length === 0) {
      return Bytes.zero(HASH_SIZE).asOpaque();
    }
    if (input.length === 1) {
      return input[0];
    }

    const mid = Math.ceil(input.length / 2);
    const left = input.slice(0, mid);
    const right = input.slice(mid);

    return hasher.hashConcat(BytesBlob.blobFromString("node").raw, [
      upperN(left, hasher).raw,
      upperN(right, hasher).raw,
    ]);
  }

  // `upperN` can return `BytesBlob` only in case of recursive invocation so casting here is safe
  return upperN(input, hasher) as TrieNodeHash;
}
