import { Bytes, type BytesBlob } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import type { TrieHasher, TrieNodeHash } from "@typeberry/trie";
import { NODE_HASH_PREFIX } from "./merkle-prefixes.js";

/**
 * Well-balanced binary Merkle root (`merklizewb` per GP E.1.1).
 *
 * Input items sit at the leaves without any leaf-level hashing; the
 * tree is built by splitting at `ceil(n/2)` and combining pairs with
 * `NODE_HASH_PREFIX`. Suitable when items are already short (around
 * 32 octets) since skipping a leaf hash keeps inclusion proofs smaller.
 *
 * For large items, or whenever constant-depth subtree-page operations
 * are needed, use `constantDepthMerkleRoot` instead. The two variants
 * produce different roots for the same input.
 *
 * https://graypaper.fluffylabs.dev/#/ab2cdbd/3fac013fac01?v=0.7.2
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

    return hasher.hashConcat(NODE_HASH_PREFIX.raw, [upperN(left, hasher).raw, upperN(right, hasher).raw]);
  }

  // `upperN` can return `BytesBlob` only in case of recursive invocation so casting here is safe
  return upperN(input, hasher) as TrieNodeHash;
}
