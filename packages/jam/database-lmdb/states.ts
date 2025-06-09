import type { HeaderHash, StateRootHash } from "@typeberry/block";
import { Decoder, Encoder } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import type { StatesDb, StateUpdateError } from "@typeberry/database";
import type { ServicesUpdate, State } from "@typeberry/state";
import type { LmdbRoot, SubDb } from "./root";
import {OK, Result, resultToString} from "@typeberry/utils";
import {SerializedState} from "@typeberry/state-merkleization";
import {StateKey} from "@typeberry/state-merkleization/keys";
import {BytesBlob} from "@typeberry/bytes";
import {LeafDb} from "./states/leaf-db";
import {OpaqueHash} from "@typeberry/hash";

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
 * "should not take a lot"™. Let's assume that we have:
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
export class LmdbStates implements StatesDb<SerializedState<LeafDb>> {
  private readonly states: SubDb;
  private readonly values: SubDb;

  constructor(
    private readonly spec: ChainSpec,
    private readonly root: LmdbRoot,
  ) {
    this.states = this.root.subDb("states");
    this.values = this.root.subDb("values");
  }

  async updateAndSetState(
    headerHash: HeaderHash,
    state: SerializedState<LeafDb>,
    update: Partial<State & ServicesUpdate>
  ): Promise<Result<SerializedState<LeafDb>, StateUpdateError>> {
    throw new Error("Method not implemented.");
  }

  getStateRoot(state: SerializedState<LeafDb>): StateRootHash {
    throw new Error("Method not implemented.");
  }

  async setState(root: HeaderHash, state: SerializedState<LeafDb>): Promise<Result<OK, StateUpdateError>> {
    // just a marker that given state is present.
    this.states.put(root.raw, new Uint8Array());
    throw new Error("Method not implemented.");
  }

  getState(root: HeaderHash): SerializedState<LeafDb> | null {
    const leafNodes = this.states.get(root.raw);
    // we don't have that particular state.
    if (leafNodes === undefined) {
      return null;
    }
    const values = this.values;
    const leafDbResult = LeafDb.fromLeafsBlob(BytesBlob.blobFrom(leafNodes), root, {
      get(key: Uint8Array): Uint8Array {
        const val = values.get(key);
        if (val === undefined) {
          throw new Error(`Missing required value: ${BytesBlob.blobFrom(key)} in the DB`);
        }
        return val;
      }
    });
    if (leafDbResult.isError) {
      throw new Error(`Inconsistent DB. Invalid leaf nodes for ${root}: ${resultToString(leafDbResult)}`);
    }
    return new SerializedState(this.spec, leafDbResult.ok);
  }
}
