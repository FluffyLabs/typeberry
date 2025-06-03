import type { StateRootHash } from "@typeberry/block";
import { type BytesBlob, InMemoryTrie } from "@typeberry/trie";
import { blake2bTrieHasher } from "@typeberry/trie/hasher";
import type { StateKey } from "./keys";
import type { StateEntries } from "./serialize-inmemory";
import type { Persistence } from "./state-serialized";

/** https://graypaper.fluffylabs.dev/#/68eaa1f/391600391600?v=0.6.4 */
export function merkelizeState(state: StateEntries): StateRootHash {
  return TriePersistence.fromStateDictionary(state).getRootHash();
}

export class TriePersistence implements Persistence {
  static fromStateDictionary(state: StateEntries) {
    // TODO [ToDr] it should be possible to do this more efficiently
    // by converting the state entries into leaf nodes and constructing
    // the trie from the trie nodes.
    const trie = InMemoryTrie.empty(blake2bTrieHasher);
    for (const [key, value] of state) {
      trie.set(key, value);
    }
    return new TriePersistence(trie, state);
  }

  private constructor(
    public readonly trie: InMemoryTrie,
    public readonly serializedState: StateEntries,
  ) {}

  getRootHash(): StateRootHash {
    return this.trie.getRootHash().asOpaque();
  }

  get(key: StateKey): BytesBlob | undefined {
    return this.serializedState.get(key);
  }
}
