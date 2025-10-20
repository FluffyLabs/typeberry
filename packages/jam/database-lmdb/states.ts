import type { HeaderHash, StateRootHash } from "@typeberry/block";
import { BytesBlob } from "@typeberry/bytes";
import { SortedSet } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import { type InitStatesDb, LeafDb, type StatesDb, StateUpdateError, updateLeafs } from "@typeberry/database";
import type { Blake2b, TruncatedHash } from "@typeberry/hash";
import { Logger } from "@typeberry/logger";
import type { ServicesUpdate, State } from "@typeberry/state";
import type { StateEntries, StateKey } from "@typeberry/state-merkleization";
import { SerializedState, StateEntryUpdateAction, serializeStateUpdate } from "@typeberry/state-merkleization";
import type { LeafNode, ValueHash } from "@typeberry/trie";
import { leafComparator } from "@typeberry/trie";
import { OK, Result, resultToString } from "@typeberry/utils";
import type { LmdbRoot, SubDb } from "./root.js";

const logger = Logger.new(import.meta.filename, "db");
/**
 * LMDB-backed state storage.
 *
 * Assumptions:
 * 1. For each block we end up with some posterior state.
 * 2. Majority of state entries will stay the same, however there are some that always change.
 * 3. We rarely need `stateRoot`, only needed to verify that we importing a
 *    block on the correct state.
 * 4. We rarely need intermediate trie nodes, only needed for answering warp-sync (CE129)
 *    and producing state proofs.
 *
 * The trie for JAM is designed so that every node takes exactly 64 bytes. Values
 * that don't fit directly into a trie node (larger than 32bytes) are hash-referenced
 * there.
 * Thanks to this, we can estimate that for each and every state, all of the leaf nodes
 * "should not take a lot". Let's assume that we have:
 * 1. 999 services
 * 2. Each service has 50 preimages, so also roughly 50 preimage lookups.
 * 3. On top of that we have 899 storage entries (arbitrary size)
 * 4. That gives us roughly 1000 trie leaves for each service (50 + 50 + 899 + 1(info))
 * 5. We have 15 always-present storage entries (let's round it up to 1k)
 *
 * Hence in total we should have 999 * 1000 + 15 ~ 1M leaves.
 * So for every state, all of the leaves should occupy roughly `64B * 1M = 64MB`.
 * Large values that do not change, are automatically deduplicated via hash-references.
 *
 * It seems very sensible then to:
 * 1. Just store trie leaves for each state.
 * 2. Prune old (finalized) states (otherwise 24h of states = 14400 blocks * 64MB ~ 1TB)
 * 3. Recompute the trie in-memory only if needed.
 *
 * Obviously from just the leaf nodes we can easily obtain the entire state.
 *
 * That's the approach we are implementing here (for now without pruning:)).
 *
 * Since when referencing some state we always think of it in terms of a posterior
 * state produced by some block, we use `HeaderHash` to index the leaf collections.
 *
 * The state root (if needed) can be easily recomputed by merkelizing the leaves.
 *
 * We might need to implement some reference counting for values, or at least
 * know the last state that is referencing them, so that they can be purged from
 * the `values` database when they are not needed any more.
 *
 * TODO [ToDr] To implement when actually needed:
 * - [ ] state pruning on finality / pre-defined window (warp threshold?)
 * - [ ] removing unused values
 */

export class LmdbStates implements StatesDb<SerializedState<LeafDb>>, InitStatesDb<StateEntries> {
  private readonly states: SubDb;
  private readonly values: SubDb;

  constructor(
    private readonly spec: ChainSpec,
    private readonly blake2b: Blake2b,
    private readonly root: LmdbRoot,
  ) {
    this.states = this.root.subDb("states");
    this.values = this.root.subDb("values");
  }

  async insertInitialState(
    headerHash: HeaderHash,
    serializedState: StateEntries,
  ): Promise<Result<OK, StateUpdateError>> {
    return await this.updateAndCommit(
      headerHash,
      SortedSet.fromArray<LeafNode>(leafComparator, []),
      Array.from(serializedState, (x) => [StateEntryUpdateAction.Insert, x[0], x[1]]),
    );
  }

  private async updateAndCommit(
    headerHash: HeaderHash,
    leafs: SortedSet<LeafNode>,
    data: Iterable<[StateEntryUpdateAction, StateKey | TruncatedHash, BytesBlob]>,
  ): Promise<Result<OK, StateUpdateError>> {
    const { values } = updateLeafs(leafs, this.blake2b, data);
    // TODO [ToDr] could be optimized to already have leaves written to one big chunk
    // (we could pre-allocate one buffer for all the leafs)
    const stateLeafs = BytesBlob.blobFromParts(leafs.array.map((x) => x.node.raw));
    // now we have the leaves and the values, so let's write it down to the DB.
    const statesWrite = this.states.put(headerHash.raw, stateLeafs.raw);
    const valuesWrite = this.values.transaction(() => {
      for (const [hash, val] of values) {
        this.values.put(hash.raw, val.raw);
      }
    });

    try {
      await Promise.all([valuesWrite, statesWrite]);
    } catch (e) {
      logger.error`${e}`;
      return Result.error(StateUpdateError.Commit, () => `Failed to commit state update: ${e}`);
    }
    return Result.ok(OK);
  }

  async updateAndSetState(
    headerHash: HeaderHash,
    state: SerializedState<LeafDb>,
    update: Partial<State & ServicesUpdate>,
  ): Promise<Result<OK, StateUpdateError>> {
    const updatedValues = serializeStateUpdate(this.spec, this.blake2b, update);
    // and finally we insert new values and store leaves in the DB.
    return await this.updateAndCommit(headerHash, state.backend.leafs, updatedValues);
  }

  async getStateRoot(state: SerializedState<LeafDb>): Promise<StateRootHash> {
    return state.backend.getStateRoot(this.blake2b);
  }

  getState(root: HeaderHash): SerializedState<LeafDb> | null {
    const leafNodes = this.states.get(root.raw);
    // we don't have that particular state.
    if (leafNodes === undefined) {
      return null;
    }
    const values = this.values;
    const leafDbResult = LeafDb.fromLeavesBlob(BytesBlob.blobFrom(leafNodes), {
      get(key: ValueHash): Uint8Array {
        const val = values.get(key.raw);
        if (val === undefined) {
          throw new Error(`Missing required value: ${key} in the DB`);
        }
        return val;
      },
    });
    if (leafDbResult.isError) {
      throw new Error(`Inconsistent DB. Invalid leaf nodes for ${root}: ${resultToString(leafDbResult)}`);
    }
    return SerializedState.new(this.spec, this.blake2b, leafDbResult.ok);
  }

  async close() {
    await Promise.all([this.states.close(), this.values.close()]);
  }
}
