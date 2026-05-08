import { Bytes, type BytesBlob } from "@typeberry/bytes";
import { type Blake2b, type Blake2bHash, HASH_SIZE } from "@typeberry/hash";
import { LEAF_HASH_PREFIX, NODE_HASH_PREFIX } from "./merkle-prefixes.js";

const ZERO_HASH = Bytes.zero(HASH_SIZE);

/**
 * Constant-depth binary Merkle root (`merklizecd` per GP E.1.2).
 *
 * Each item is hashed with `LEAF_HASH_PREFIX`, the sequence is padded
 * to the next power of two with the zero hash, then folded into a
 * balanced tree where every leaf sits at the same depth. Internal
 * nodes use `NODE_HASH_PREFIX`.
 *
 * Unlike `binaryMerkleization` (the well-balanced variant), this tree
 * has a uniform shape and pre-hashes leaves. Prefer it for large
 * items, or whenever subtree-page operations are needed.
 *
 * https://graypaper.fluffylabs.dev/#/ab2cdbd/3ff5013ff501?v=0.7.2
 */
export function constantDepthMerkleRoot(leaves: BytesBlob[], blake2b: Blake2b): Blake2bHash {
  if (leaves.length === 0) {
    return ZERO_HASH.asOpaque();
  }

  const paddedLength = nextPowerOfTwo(leaves.length);
  let level: Bytes<typeof HASH_SIZE>[] = new Array(paddedLength);
  // hash leaves
  for (let i = 0; i < leaves.length; i++) {
    level[i] = blake2b.hashBlobs([LEAF_HASH_PREFIX, leaves[i]]);
  }
  // fill rest with zero hash
  for (let i = leaves.length; i < paddedLength; i++) {
    level[i] = ZERO_HASH;
  }

  // now compute the merkle root
  while (level.length > 1) {
    const next: Bytes<typeof HASH_SIZE>[] = new Array(level.length / 2);
    for (let i = 0; i < next.length; i++) {
      next[i] = blake2b.hashBlobs([NODE_HASH_PREFIX, level[2 * i], level[2 * i + 1]]);
    }
    level = next;
  }

  return level[0].asOpaque();
}

// Smallest power of two `>= leaves.length`, via count-leading-zeros.
// Safe up to 2^30; exports per work-package are capped well below that.
function nextPowerOfTwo(n: number) {
  return 1 << (32 - Math.clz32(n - 1));
}
