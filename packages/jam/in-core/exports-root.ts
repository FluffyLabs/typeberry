import type { Segment } from "@typeberry/block";
import type { ExportsRootHash } from "@typeberry/block/refine-context.js";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import type { Blake2b } from "@typeberry/hash";
import { HASH_SIZE } from "@typeberry/hash";

const LEAF_PREFIX = BytesBlob.blobFromString("leaf");
const NODE_PREFIX = BytesBlob.blobFromString("node");

/**
 * Computes the segment-root commitment for segments exported by a work-package.
 * https://graypaper.fluffylabs.dev/#/ab2cdbd/1be4011be901?v=0.7.2
 *
 * GP E.4: Merkle function `M` = N(C(v, H), H)
 * C - creates leafs and padds
 * N - creates tree and returns root
 * https://graypaper.fluffylabs.dev/#/ab2cdbd/3d56003d5600?v=0.7.2
 *
 * @param exports Exports must be grouped and supplied in work-item order,
 * with each inner sequence preserving that work-item’s segment export order.
 * https://graypaper.fluffylabs.dev/#/ab2cdbd/1be5011be701?v=0.7.2
 */
export function computeExportsRoot(exports: readonly (readonly Segment[])[], blake2b: Blake2b): ExportsRootHash {
  let nodes: ExportsRootHash[] = [];
  // GP E.7: C hashes every segment with $leaf and pads with H₀.
  // https://graypaper.fluffylabs.dev/#/ab2cdbd/3d1c013d1c01?v=0.7.2
  for (const workItemExports of exports) {
    for (const segment of workItemExports) {
      nodes.push(blake2b.hashBlobs<ExportsRootHash>([LEAF_PREFIX, segment]));
    }
  }

  // If we dont have any exports we return H₀.
  const zeroHash = Bytes.zero(HASH_SIZE).asOpaque<ExportsRootHash>();
  if (nodes.length === 0) {
    return zeroHash;
  }

  // Padding with H₀.
  const paddedLength = 2 ** Math.ceil(Math.log2(nodes.length));
  while (nodes.length < paddedLength) {
    nodes.push(zeroHash);
  }

  // GP E.1: iterative bottom-up implementation of N
  // https://graypaper.fluffylabs.dev/#/ab2cdbd/3ca7013ca701?v=0.7.2
  while (nodes.length > 1) {
    const nextLevel: ExportsRootHash[] = [];
    for (let i = 0; i < nodes.length; i += 2) {
      nextLevel.push(blake2b.hashBlobs<ExportsRootHash>([NODE_PREFIX, nodes[i], nodes[i + 1]]));
    }
    nodes = nextLevel;
  }

  // If we have 1 segment we return that segment's leaf hash.
  return nodes[0];
}
