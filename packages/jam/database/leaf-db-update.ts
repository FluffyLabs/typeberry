import { BytesBlob } from "@typeberry/bytes";
import type { SortedSet } from "@typeberry/collections";
import type { Blake2b, TruncatedHash } from "@typeberry/hash";
import { StateEntryUpdateAction, type StateKey } from "@typeberry/state-merkleization";
import { InMemoryTrie, type LeafNode, type ValueHash } from "@typeberry/trie";
import { getBlake2bTrieHasher } from "@typeberry/trie/hasher.js";
import { assertNever } from "@typeberry/utils";

export function updateLeafs(
  leafs: SortedSet<LeafNode>,
  blake2b: Blake2b,
  data: Iterable<[StateEntryUpdateAction, StateKey | TruncatedHash, BytesBlob]>,
): {
  values: [ValueHash, BytesBlob][];
  removed: ValueHash[];
  leafs: SortedSet<LeafNode>;
} {
  const blake2bTrieHasher = getBlake2bTrieHasher(blake2b);
  // We will collect all values that don't fit directly into leaf nodes.
  const values: [ValueHash, BytesBlob][] = [];
  // Value hashes that are no longer referenced by the leaf they were stored under.
  // NOTE this does not yet mean they can be removed from the DB - the same value
  // may still be referenced by another leaf or another state. It's up to value
  // ref-counting to decide that.
  const removed: ValueHash[] = [];
  for (const [action, key, value] of data) {
    if (action === StateEntryUpdateAction.Insert) {
      const leafNode = InMemoryTrie.constructLeaf(blake2bTrieHasher, key.asOpaque(), value);
      const displaced = leafs.replace(leafNode);
      const newHash = leafNode.hasEmbeddedValue() ? null : leafNode.getValueHash();
      const oldHash = displaced !== undefined && !displaced.hasEmbeddedValue() ? displaced.getValueHash() : null;
      // Re-inserting the exact same value under the same key is a no-op for the DB.
      if (newHash !== null && oldHash !== null && newHash.isEqualTo(oldHash)) {
        continue;
      }
      if (newHash !== null) {
        values.push([newHash, value]);
      }
      if (oldHash !== null) {
        removed.push(oldHash);
      }
    } else if (action === StateEntryUpdateAction.Remove) {
      const leafNode = InMemoryTrie.constructLeaf(blake2bTrieHasher, key.asOpaque(), BytesBlob.empty());
      const removedLeaf = leafs.removeOne(leafNode);
      if (removedLeaf !== undefined && !removedLeaf.hasEmbeddedValue()) {
        removed.push(removedLeaf.getValueHash());
      }
    } else {
      assertNever(action);
    }
  }

  return {
    values,
    removed,
    leafs,
  };
}
