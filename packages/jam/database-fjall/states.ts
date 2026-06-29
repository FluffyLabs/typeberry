import type { HeaderHash, StateRootHash } from "@typeberry/block";
import { BytesBlob } from "@typeberry/bytes";
import { SortedSet } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import {
  type InitStatesDb,
  LeafDb,
  type StatesDb,
  StateUpdateError,
  updateLeafs,
  type ValuesDb,
} from "@typeberry/database";
import type { Blake2b, TruncatedHash } from "@typeberry/hash";
import { Logger } from "@typeberry/logger";
import type { ServicesUpdate, State } from "@typeberry/state";
import type { StateEntries, StateKey } from "@typeberry/state-merkleization";
import { SerializedState, StateEntryUpdateAction, serializeStateUpdate } from "@typeberry/state-merkleization";
import { type LeafNode, leafComparator, type ValueHash } from "@typeberry/trie";
import { OK, Result, resultToString } from "@typeberry/utils";
import { type FjallPartition, type FjallRoot, type Partition, toUint8Array } from "./root.js";

const logger = Logger.new(import.meta.filename, "db");

/** fjall-backed full on-disk serialized state storage. */
export class FjallStates implements StatesDb<SerializedState<LeafDb>>, InitStatesDb<StateEntries> {
  static async open(spec: ChainSpec, blake2b: Blake2b, root: FjallRoot): Promise<FjallStates> {
    const [states, values] = await Promise.all([root.partition("states"), root.partition("values")]);
    return new FjallStates(spec, blake2b, root, states, values);
  }

  private readonly valuesDb: ValuesDb;

  private constructor(
    private readonly spec: ChainSpec,
    private readonly blake2b: Blake2b,
    private readonly root: FjallRoot,
    private readonly states: FjallPartition,
    private readonly values: FjallPartition,
  ) {
    this.valuesDb = { get: (key: ValueHash) => this.readValue(key) };
  }

  async insertInitialState(headerHash: HeaderHash, entries: StateEntries): Promise<Result<OK, StateUpdateError>> {
    return await this.updateAndCommit(
      headerHash,
      SortedSet.fromArray<LeafNode>(leafComparator, []),
      Array.from(entries, (x) => [StateEntryUpdateAction.Insert, x[0], x[1]]),
    );
  }

  async updateAndSetState(
    headerHash: HeaderHash,
    state: SerializedState<LeafDb>,
    update: Partial<State & ServicesUpdate>,
  ): Promise<Result<OK, StateUpdateError>> {
    const updatedValues = serializeStateUpdate(this.spec, this.blake2b, update);
    const newLeafs = SortedSet.fromSortedArray(leafComparator, state.backend.leafs.array);
    const res = await this.updateAndCommit(headerHash, newLeafs, updatedValues);
    if (res.isOk) {
      state.updateBackend(LeafDb.fromLeaves(newLeafs, this.valuesDb));
    }
    return res;
  }

  async getStateRoot(state: SerializedState<LeafDb>): Promise<StateRootHash> {
    return state.backend.getStateRoot(this.blake2b);
  }

  getState(headerHash: HeaderHash): SerializedState<LeafDb> | null {
    const leafNodes = toUint8Array(this.states.get(headerHash.raw));
    if (leafNodes === null) {
      return null;
    }

    const leafDbResult = LeafDb.fromLeavesBlob(BytesBlob.blobFrom(leafNodes), this.valuesDb);
    if (leafDbResult.isError) {
      throw new Error(`Inconsistent DB. Invalid leaf nodes for ${headerHash}: ${resultToString(leafDbResult)}`);
    }
    return SerializedState.new(this.spec, this.blake2b, leafDbResult.ok);
  }

  commitFinalized(_headers: HeaderHash[]): void {
    // Values are never pruned here. This db survives restarts, so refcounting
    // would need counts persisted (and crash-consistent) alongside the values.
  }

  markUnused(headerHash: HeaderHash): void {
    void writable(this.states, this.root)
      .remove(headerHash.raw)
      .catch((e) => logger.warn`Failed to prune state ${headerHash}: ${e}`);
  }

  diskSizeInBytes(): number | null {
    return this.root.sizeInBytes();
  }

  async close() {}

  private async updateAndCommit(
    headerHash: HeaderHash,
    leafs: SortedSet<LeafNode>,
    data: Iterable<[StateEntryUpdateAction, StateKey | TruncatedHash, BytesBlob]>,
  ): Promise<Result<OK, StateUpdateError>> {
    const { values } = updateLeafs(leafs, this.blake2b, data);
    const stateLeafs = BytesBlob.blobFromParts(leafs.array.map((x) => x.node.raw));

    try {
      // Preserve dependency order: values first, then leaves that may reference them.
      if (values.length > 0) {
        await writable(this.values, this.root).insertBatch(
          values.map(([hash, val]) => ({ key: hash.raw, value: val.raw })),
        );
      }
      await writable(this.states, this.root).insert(headerHash.raw, stateLeafs.raw);
      await this.root.persist();
    } catch (e) {
      logger.error`${e}`;
      return Result.error(StateUpdateError.Commit, () => `Failed to commit state update: ${e}`);
    }

    return Result.ok(OK);
  }

  private readValue(key: ValueHash): Uint8Array {
    const val = toUint8Array(this.values.get(key.raw));
    if (val === null) {
      throw new Error(`Missing required value: ${key} in the DB`);
    }
    return val;
  }
}

function writable(partition: FjallPartition, root: FjallRoot): Partition {
  if (root.readOnly) {
    throw new Error("Cannot write through a read-only fjall partition.");
  }
  return partition as Partition;
}
