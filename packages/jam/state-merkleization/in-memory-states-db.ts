import type { HeaderHash, StateRootHash } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import { HashDictionary, SortedSet } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import { type InitStatesDb, LeafDb, type StatesDb, type StateUpdateError } from "@typeberry/database";
import { Blake2b } from "@typeberry/hash";
import type { State } from "@typeberry/state/state.js";
import type { ServicesUpdate } from "@typeberry/state/state-update.js";
import { leafComparator, type ValueHash } from "@typeberry/trie";
import { OK, Result } from "@typeberry/utils";
import { updateLeafs } from "./leafs-db-update.js";
import { StateEntryUpdateAction, serializeStateUpdate } from "./serialize-state-update.js";
import { SerializedState } from "./serialized-state.js";
import type { StateEntries } from "./state-entries.js";

export class InMemorySerializedStates implements StatesDb<SerializedState<LeafDb>>, InitStatesDb<StateEntries> {
  private readonly db: HashDictionary<HeaderHash, SerializedState<LeafDb>> = HashDictionary.new();
  private readonly valuesDb: HashDictionary<ValueHash, BytesBlob> = HashDictionary.new();
  private readonly blake2b: Promise<Blake2b>;

  constructor(private readonly spec: ChainSpec) {
    this.blake2b = Blake2b.createHasher();
  }

  async insertInitialState(headerHash: HeaderHash, entries: StateEntries): Promise<Result<OK, StateUpdateError>> {
    const blake2b = await this.blake2b;
    // convert state entries into leafdb
    const { values, leafs } = updateLeafs(
      SortedSet.fromArray(leafComparator, []),
      blake2b,
      Array.from(entries, (x) => [StateEntryUpdateAction.Insert, x[0], x[1]]),
    );

    // insert values to the db.
    for (const val of values) {
      this.valuesDb.set(val[0], val[1]);
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
    this.db.set(headerHash, SerializedState.new(this.spec, blake2b, leafDb));
    return Result.ok(OK);
  }

  async getStateRoot(state: SerializedState<LeafDb>): Promise<StateRootHash> {
    return state.backend.getStateRoot(await this.blake2b);
  }

  async updateAndSetState(
    header: HeaderHash,
    state: SerializedState<LeafDb>,
    update: Partial<State & ServicesUpdate>,
  ): Promise<Result<OK, StateUpdateError>> {
    const blake2b = await this.blake2b;
    const updatedValues = serializeStateUpdate(this.spec, blake2b, update);
    const { values } = updateLeafs(state.backend.leafs, blake2b, updatedValues);

    // insert values to the db
    // valuesdb can be shared between all states because it's just
    // <valuehash> -> <value> mapping and existence is managed by trie leafs.
    for (const val of values) {
      this.valuesDb.set(val[0], val[1]);
    }

    this.db.set(header, state);

    return Result.ok(OK);
  }

  getState(header: HeaderHash): SerializedState<LeafDb> | null {
    return this.db.get(header) ?? null;
  }
}
