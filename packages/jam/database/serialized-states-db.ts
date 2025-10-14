import type { HeaderHash, StateRootHash } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import { HashDictionary, SortedSet } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import type { Blake2b } from "@typeberry/hash";
import type { State } from "@typeberry/state/state.js";
import type { ServicesUpdate } from "@typeberry/state/state-update.js";
import {
  SerializedState,
  type StateEntries,
  StateEntryUpdateAction,
  serializeStateUpdate,
} from "@typeberry/state-merkleization";
import { type LeafNode, leafComparator, type ValueHash } from "@typeberry/trie";
import { OK, Result } from "@typeberry/utils";
import { LeafDb } from "./leaf-db.js";
import { updateLeafs } from "./leaf-db-update.js";
import type { InitStatesDb, StatesDb, StateUpdateError } from "./states.js";

/** Abstract serialized-states db. */
export type SerializedStatesDb = StatesDb<SerializedState<LeafDb>> & InitStatesDb<StateEntries>;

/** In-memory serialized-states db. */
export class InMemorySerializedStates implements StatesDb<SerializedState<LeafDb>>, InitStatesDb<StateEntries> {
  private readonly db: HashDictionary<HeaderHash, SortedSet<LeafNode>> = HashDictionary.new();
  private readonly valuesDb: HashDictionary<ValueHash, BytesBlob> = HashDictionary.new();

  constructor(
    private readonly spec: ChainSpec,
    private readonly blake2b: Blake2b,
  ) {}

  async insertInitialState(headerHash: HeaderHash, entries: StateEntries): Promise<Result<OK, StateUpdateError>> {
    // convert state entries into leafdb
    const { values, leafs } = updateLeafs(
      SortedSet.fromArray(leafComparator, []),
      this.blake2b,
      Array.from(entries, (x) => [StateEntryUpdateAction.Insert, x[0], x[1]]),
    );

    // insert values to the db.
    for (const val of values) {
      this.valuesDb.set(val[0], val[1]);
    }

    this.db.set(headerHash, leafs);
    return Result.ok(OK);
  }

  async getStateRoot(state: SerializedState<LeafDb>): Promise<StateRootHash> {
    return state.backend.getStateRoot(this.blake2b);
  }

  async updateAndSetState(
    header: HeaderHash,
    state: SerializedState<LeafDb>,
    update: Partial<State & ServicesUpdate>,
  ): Promise<Result<OK, StateUpdateError>> {
    const blake2b = this.blake2b;
    const updatedValues = serializeStateUpdate(this.spec, blake2b, update);
    const { values, leafs } = updateLeafs(state.backend.leafs, blake2b, updatedValues);

    // insert values to the db
    // valuesdb can be shared between all states because it's just
    // <valuehash> -> <value> mapping and existence is managed by trie leafs.
    for (const val of values) {
      this.valuesDb.set(val[0], val[1]);
    }

    // make sure to clone the leafs before writing, since the collection is re-used.
    this.db.set(header, SortedSet.fromSortedArray(leafComparator, leafs.slice()));

    return Result.ok(OK);
  }

  getState(header: HeaderHash): SerializedState<LeafDb> | null {
    const leafs = this.db.get(header);
    if (leafs === undefined) {
      return null;
    }
    // now create a leafdb with shared values db.
    const leafDb = LeafDb.fromLeaves(leafs, {
      get: (key: ValueHash) => {
        const val = this.valuesDb.get(key);
        if (val === undefined) {
          throw new Error(`Missing value at key: ${key}`);
        }
        return val.raw;
      },
    });
    return SerializedState.new(this.spec, this.blake2b, leafDb);
  }
}
