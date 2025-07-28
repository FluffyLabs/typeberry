import type { HeaderHash, StateRootHash } from "@typeberry/block";
import type { WorkPackageHash, WorkPackageInfo } from "@typeberry/block/work-report.js";
import { Bytes } from "@typeberry/bytes";
import { type HashDictionary, asKnownSize } from "@typeberry/collections";
import { HASH_SIZE, type KeccakHash, type OpaqueHash } from "@typeberry/hash";
import { MerkleMountainRange, type MmrHasher } from "@typeberry/mmr";
import { type LegacyRecentBlocks, MAX_RECENT_HISTORY, type State } from "@typeberry/state";
import type { RecentBlocks } from "@typeberry/state/recent-blocks.js";
import { Compatibility, GpVersion } from "@typeberry/utils";

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

/** Update of the recent history state. */
export type RecentHistoryStateUpdate = Pick<RecentHistoryState, "recentBlocks">;

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

  transition(input: RecentHistoryInput): RecentHistoryStateUpdate {
    const recentBlocks = Compatibility.isGreaterOrEqual(GpVersion.V0_6_7)
      ? (this.state.recentBlocks as RecentBlocks).blocks.slice()
      : (this.state.recentBlocks as LegacyRecentBlocks).slice();
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
    return {
      // we remove all items above `MAX_RECENT_HISTORY`.
      recentBlocks: asKnownSize(recentBlocks),
    };
  }
}
