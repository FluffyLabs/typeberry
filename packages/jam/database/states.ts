import type { StateRootHash } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import { HashDictionary } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import type { State } from "@typeberry/state";
import { stateDumpCodec } from "@typeberry/state-merkleization/dump";

/**
 * Temporary and simple state database interface.
 *
 * We store the entire state with full keys under it's state root hash.
 *
 * Note that this is sub-optimal for some reasons:
 * 1. Answering CE-129 queries requires us storing all trie nodes.
 * 2. We can't load `SerializedState` (since we don't have full keys).
 * 3. We store a lot of duplicated data.
 *
 * but also nice (we have full key data - fast retrieval) and simple (easy access
 * to the state fields, loading state, etc), but might not be sustainable.
 *
 * A slightly better option would be to store only changes to the state instead of full
 * one.
 *
 * Some other options that we have:
 * 1. Store `SerializedState` and compute the merkle trie on-demand.
 *    1. If our storage is somehow based on the merkle trie keys we could answer
 *       ce-129 given the key. (nomt approach)
 *    2. If our storage is more naive we will not know what exact state neededs
 *       to be merkelized when a random trie node is requested.
 * 2. Store all trie nodes and do some pruning of old ones - basically an archive node.
 *
 * In case of any of these options, when accessing state we will need to compute
 * the keys before retrieving the data (which is slower).
 *
 */
export interface StatesDb {
  /** Insert a full state with given state root hash. */
  insertFullState(root: StateRootHash, state: State): Promise<void>;
  /** Retrieve state with given state root hash. */
  getFullState(root: StateRootHash): State | null;
}

export class InMemoryStates implements StatesDb {
  private readonly db: HashDictionary<StateRootHash, BytesBlob> = HashDictionary.new();

  constructor(private readonly spec: ChainSpec) {}

  async insertFullState(root: StateRootHash, state: State): Promise<void> {
    const encoded = Encoder.encodeObject(stateDumpCodec, state, this.spec);
    this.db.set(root, encoded);
  }

  getFullState(root: StateRootHash): State | null {
    const encodedState = this.db.get(root);
    if (encodedState === undefined) {
      return null;
    }

    return Decoder.decodeObject(stateDumpCodec, encodedState, this.spec);
  }
}
