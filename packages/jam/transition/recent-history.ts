import type { HeaderHash, StateRootHash } from "@typeberry/block";
import type { WorkPackageHash, WorkPackageInfo } from "@typeberry/block/work-report";
import { Bytes } from "@typeberry/bytes";
import { type HashDictionary, asKnownSize } from "@typeberry/collections";
import { HASH_SIZE, type KeccakHash, type OpaqueHash } from "@typeberry/hash";
import { MerkleMountainRange, type MmrHasher } from "@typeberry/mmr";
import { MAX_RECENT_HISTORY, type State } from "@typeberry/state";
import { StateUpdate } from "@typeberry/state/state-update";

/** Current block input for the recent history transition. */
export type RecentHistoryInput = {
  /** Current header hash. */
  headerHash: HeaderHash;
  /** State root before current header. */
  priorStateRoot: StateRootHash;
  /**
   * `C`: BEEFY commitment.
   *
   * https://graypaper.fluffylabs.dev/#/579bd12/172803172a03
   */
  accumulateRoot: OpaqueHash;
  /** Work packages in the guarantees extrinsic. */
  workPackages: HashDictionary<WorkPackageHash, WorkPackageInfo>;
};

/** Recent history tests state. */
export type RecentHistoryState = Pick<State, "recentBlocks">;

/**
 * Recent History transition function.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/0faf010faf01
 */
export class RecentHistory {
  constructor(
    private readonly hasher: MmrHasher<KeccakHash>,
    public readonly state: RecentHistoryState,
  ) {}

  transition(input: RecentHistoryInput): StateUpdate<RecentHistoryState> {
    const recentBlocks = this.state.recentBlocks.slice();
    const lastState = recentBlocks.length > 0 ? recentBlocks[recentBlocks.length - 1] : null;
    // update the posterior root of previous state.
    if (lastState !== null) {
      lastState.postStateRoot = input.priorStateRoot;
    }

    const mmr =
      lastState !== null
        ? MerkleMountainRange.fromPeaks(this.hasher, lastState.mmr)
        : MerkleMountainRange.empty(this.hasher);

    // append the accumulation root
    mmr.append(input.accumulateRoot);

    // push new state item
    recentBlocks.push({
      headerHash: input.headerHash,
      mmr: mmr.getPeaks(),
      postStateRoot: Bytes.zero(HASH_SIZE).asOpaque(),
      reported: input.workPackages,
    });
    if (recentBlocks.length > MAX_RECENT_HISTORY) {
      recentBlocks.shift();
    }

    // write back to the state.
    return StateUpdate.new({
      // we remove all items above `MAX_RECENT_HISTORY`.
      recentBlocks: asKnownSize(recentBlocks),
    });
  }
}
