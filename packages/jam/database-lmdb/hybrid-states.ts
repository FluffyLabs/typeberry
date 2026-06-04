// packages/jam/database-lmdb/hybrid-states.ts
import type { HeaderHash, StateRootHash } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import { HashDictionary, SortedSet } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import {
  type InitStatesDb,
  LeafDb,
  type StatesDb,
  StateUpdateError,
  updateLeafs,
  type ValuesDb,
} from "@typeberry/database";
import type { Blake2b } from "@typeberry/hash";
import type { ServicesUpdate, State } from "@typeberry/state";
import {
  SerializedState,
  type StateEntries,
  StateEntryUpdateAction,
  serializeStateUpdate,
} from "@typeberry/state-merkleization";
import { type LeafNode, leafComparator, type ValueHash } from "@typeberry/trie";
import { OK, Result } from "@typeberry/utils";
import { LmdbRoot, type SubDb } from "./root.js";

/**
 * Hybrid serialized-states db.
 *
 * States (leafs) are kept in-memory, but large values are persisted to lmdb.
 * Reads go straight to lmdb, which keeps its own page cache.
 * NOTE: this DB is designed for long fuzzing and to be used with pruning to
 * keep the heap usage bounded.
 */
export class HybridSerializedStates implements StatesDb<SerializedState<LeafDb>>, InitStatesDb<StateEntries> {
  private readonly inMemStates: HashDictionary<HeaderHash, SortedSet<LeafNode>> = HashDictionary.new();
  private readonly lmdbValues: SubDb;
  // A single shared values accessor reused by every `LeafDb` we hand out.
  private readonly valuesDb: ValuesDb;

  static new({
    spec,
    blake2b,
    dbPath,
    readOnly,
    ephemeral,
    compression,
  }: {
    spec: ChainSpec;
    blake2b: Blake2b;
    dbPath: string;
    readOnly?: boolean;
    ephemeral?: boolean;
    compression?: boolean;
  }) {
    const root = LmdbRoot.new(dbPath, { readOnly, ephemeral, compression });
    return new HybridSerializedStates(spec, blake2b, root);
  }

  private constructor(
    private readonly spec: ChainSpec,
    private readonly blake2b: Blake2b,
    private readonly root: LmdbRoot,
  ) {
    this.lmdbValues = this.root.subDb("values");
    this.valuesDb = { get: (key: ValueHash) => this.readValue(key) };
  }

  async insertInitialState(headerHash: HeaderHash, entries: StateEntries): Promise<Result<OK, StateUpdateError>> {
    const { values, leafs } = updateLeafs(
      SortedSet.fromArray(leafComparator, []),
      this.blake2b,
      Array.from(entries, (x) => [StateEntryUpdateAction.Insert, x[0], x[1]]),
    );
    const res = await this.writeValues(values);
    if (res.isError) {
      return res;
    }
    this.inMemStates.set(headerHash, leafs);
    return Result.ok(OK);
  }

  async updateAndSetState(
    header: HeaderHash,
    state: SerializedState<LeafDb>,
    update: Partial<State & ServicesUpdate>,
  ): Promise<Result<OK, StateUpdateError>> {
    const updatedValues = serializeStateUpdate(this.spec, this.blake2b, update);
    // Clone the leaf set before mutating: the previous state keeps using its own.
    const newLeafs = SortedSet.fromSortedArray(leafComparator, state.backend.leafs.array);
    const { values, leafs } = updateLeafs(newLeafs, this.blake2b, updatedValues);
    const res = await this.writeValues(values);
    if (res.isError) {
      // Leave the caller's state untouched: its new leaves would reference
      // values that never reached disk.
      return res;
    }
    // Re-create the lookup with the shared values accessor only once the new
    // values are durably written.
    state.updateBackend(LeafDb.fromLeaves(leafs, this.valuesDb));
    this.inMemStates.set(header, leafs);
    return Result.ok(OK);
  }

  async getStateRoot(state: SerializedState<LeafDb>): Promise<StateRootHash> {
    return state.backend.getStateRoot(this.blake2b);
  }

  getState(header: HeaderHash): SerializedState<LeafDb> | null {
    const leafs = this.inMemStates.get(header);
    if (leafs === undefined) {
      return null;
    }
    const leafDb = LeafDb.fromLeaves(leafs, this.valuesDb);
    return SerializedState.new(this.spec, this.blake2b, leafDb);
  }

  markUnused(header: HeaderHash): void {
    // We only remove the state from memory - values are not pruned at all,
    // but since they are stored on disk we should be safe.
    this.inMemStates.delete(header);
  }

  diskSizeInBytes(): number | null {
    return this.root.sizeInBytes();
  }

  async close() {
    await this.lmdbValues.close();
    await this.root.close();
  }

  /** Write new large values to LMDB in one transaction. */
  private async writeValues(values: [ValueHash, BytesBlob][]): Promise<Result<OK, StateUpdateError>> {
    if (values.length === 0) {
      return Result.ok(OK);
    }
    try {
      await this.lmdbValues.transaction(() => {
        for (const [hash, val] of values) {
          this.lmdbValues.put(hash.raw, val.raw);
        }
      });
    } catch (e) {
      return Result.error(StateUpdateError.Commit, () => `Failed to commit values: ${e}`);
    }
    return Result.ok(OK);
  }

  /** Read a value from LMDB. */
  private readValue(key: ValueHash): Uint8Array {
    const val = this.lmdbValues.get(key.raw);
    if (val === undefined) {
      throw new Error(`Missing value at key: ${key}`);
    }
    return val;
  }
}
