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
  leafs: SortedSet<LeafNode>;
} {
  const blake2bTrieHasher = getBlake2bTrieHasher(blake2b);
  // We will collect all values that don't fit directly into leaf nodes.
  const values: [ValueHash, BytesBlob][] = [];
  for (const [action, key, value] of data) {
    if (action === StateEntryUpdateAction.Insert) {
      const leafNode = InMemoryTrie.constructLeaf(blake2bTrieHasher, key.asOpaque(), value);
      leafs.replace(leafNode);
      if (!leafNode.hasEmbeddedValue()) {
        values.push([leafNode.getValueHash(), value]);
      }
    } else if (action === StateEntryUpdateAction.Remove) {
      const leafNode = InMemoryTrie.constructLeaf(blake2bTrieHasher, key.asOpaque(), BytesBlob.empty());
      leafs.removeOne(leafNode);
      // TODO [ToDr] Handle ref-counting values or updating some header-hash-based references.
    } else {
      assertNever(action);
    }
  }

  return {
    values,
    leafs,
  };
}
