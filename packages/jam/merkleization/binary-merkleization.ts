import { Bytes, BytesBlob } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import type { TrieHasher, TrieNodeHash } from "@typeberry/trie";

export const NODE_PREFIX = BytesBlob.blobFromString("node");

/**
 * GP E.1: Computes the binary Merkle node function `N` in-place (depth-first, left-first).
 *
 * The input array is used as working memory and must not be reused by the caller.
 * After method is done, nodes are corrupted, and cannot be reused again.
 * https://graypaper.fluffylabs.dev/#/ab2cdbd/3ca7013ca701?v=0.7.2
 *
 * Example:
 *  [     1, 2, 3,   4, 5]
 *  [   H12, 2, 3,   4, 5]
 *  [  H123, 2, 3,   4, 5]
 *  [  H123, 2, 3, H45, 5]
 *  [H12345, 2, 3, H45, 5]
 */
export function binaryMerkleTreeRoot<T>(nodes: T[], zero: T, hashNode: (left: T, right: T) => T): T {
  if (nodes.length === 0) {
    return zero;
  }
  if (nodes.length === 1) {
    return nodes[0];
  }

  const starts = [0];
  const lengths = [nodes.length];
  const stages = [0];

  while (starts.length > 0) {
    const frame = starts.length - 1;
    const start = starts[frame];
    const length = lengths[frame];
    const leftLength = Math.ceil(length / 2);

    // left node
    if (stages[frame] === 0) {
      stages[frame] = 1;
      if (leftLength > 1) {
        starts.push(start);
        lengths.push(leftLength);
        stages.push(0);
      }
      continue;
    }

    // right node
    const rightLength = length - leftLength;
    if (stages[frame] === 1) {
      stages[frame] = 2;
      if (rightLength > 1) {
        starts.push(start + leftLength);
        lengths.push(rightLength);
        stages.push(0);
      }
      continue;
    }

    // hash 2 nodes and save in left one
    nodes[start] = hashNode(nodes[start], nodes[start + leftLength]);
    starts.pop();
    lengths.pop();
    stages.pop();
  }

  // root is always first in array
  return nodes[0];
}

/**
 * GP E.3: Binary merkleization for well-balanced trees.
 * The input array is used as working memory.
 *
 * https://graypaper.fluffylabs.dev/#/ab2cdbd/3c5f033c5f03?v=0.7.2
 */
export function binaryMerkleization(input: BytesBlob[], hasher: TrieHasher): TrieNodeHash {
  if (input.length === 1) {
    return hasher.hashConcat(input[0].raw);
  }

  return binaryMerkleTreeRoot(input, Bytes.zero(HASH_SIZE), (left, right) =>
    hasher.hashConcat(NODE_PREFIX.raw, [left.raw, right.raw]),
  ) as TrieNodeHash;
}
