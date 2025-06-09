import type { StateRootHash } from "@typeberry/block";
import { InMemoryTrie } from "@typeberry/trie";
import { blake2bTrieHasher } from "@typeberry/trie/hasher";
import type { StateEntries } from "./serialize-inmemory";

/** https://graypaper.fluffylabs.dev/#/68eaa1f/391600391600?v=0.6.4 */
export function merkelizeState(state: StateEntries): StateRootHash {
  // TODO [ToDr] it should be possible to do this more efficiently
  // by converting the state entries into leaf nodes and constructing
  // the trie from the trie nodes.
  const trie = InMemoryTrie.empty(blake2bTrieHasher);
  for (const [key, value] of state) {
    trie.set(key, value);
  }
  return trie.getRootHash().asOpaque();
}
