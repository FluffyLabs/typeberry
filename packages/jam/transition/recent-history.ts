import type { HeaderHash, StateRootHash } from "@typeberry/block";
import type { WorkPackageHash, WorkPackageInfo } from "@typeberry/block/work-report.js";
import { Bytes } from "@typeberry/bytes";
import { type HashDictionary, asKnownSize } from "@typeberry/collections";
import { HASH_SIZE, type KeccakHash, type OpaqueHash } from "@typeberry/hash";
import { MerkleMountainRange, type MmrHasher } from "@typeberry/mmr";
import {
  type BlockState,
  type LegacyBlockState,
  type LegacyRecentBlocks,
  MAX_RECENT_HISTORY,
  RecentBlocks,
  type State,
} from "@typeberry/state";
import { Compatibility, GpVersion } from "@typeberry/utils";

/** Current block input for the recent history transition. */
export type RecentHistoryInput = {
  /** Current header hash. */
  headerHash: HeaderHash;
  /** State root before current header. */
  priorStateRoot: StateRootHash;
  /**
   * `θ`: accumulation-output
   *
   * https://graypaper.fluffylabs.dev/#/7e6ff6a/18e60118e801?v=0.6.7
   *
   * NOTE === Pre 067 ===
   *
   * `C`: BEEFY commitment.
   *
   * https://graypaper.fluffylabs.dev/#/579bd12/172803172a03?v=0.5.4
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
 * https://graypaper.fluffylabs.dev/#/579bd12/0faf010faf01?v=0.5.4
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/0fb1010fb101?v=0.6.7
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

    const lastAccumulationLog = Compatibility.isGreaterOrEqual(GpVersion.V0_6_7)
      ? (this.state.recentBlocks as RecentBlocks).accumulationLog
      : null;

    const lastState = recentBlocks.length > 0 ? recentBlocks[recentBlocks.length - 1] : null;

    // update the posterior root of previous state.
    if (lastState !== null) {
      lastState.postStateRoot = input.priorStateRoot;
    }

    const mmr = Compatibility.isGreaterOrEqual(GpVersion.V0_6_7)
      ? lastAccumulationLog !== null
        ? MerkleMountainRange.fromPeaks(this.hasher, lastAccumulationLog)
        : MerkleMountainRange.empty(this.hasher)
      : lastState !== null
        ? MerkleMountainRange.fromPeaks(this.hasher, (lastState as LegacyBlockState).mmr)
        : MerkleMountainRange.empty(this.hasher);

    // append the accumulation root
    mmr.append(input.accumulateRoot);

    // push new state item
    if (Compatibility.isGreaterOrEqual(GpVersion.V0_6_7)) {
      (recentBlocks as BlockState[]).push({
        headerHash: input.headerHash,
        accumulationResult: mmr.getSuperPeakHash(),
        postStateRoot: Bytes.zero(HASH_SIZE).asOpaque(),
        reported: input.workPackages,
      });
    } else {
      (recentBlocks as LegacyBlockState[]).push({
        headerHash: input.headerHash,
        mmr: mmr.getPeaks(),
        postStateRoot: Bytes.zero(HASH_SIZE).asOpaque(),
        reported: input.workPackages,
      });
    }

    // we remove all items above `MAX_RECENT_HISTORY`.
    if (recentBlocks.length > MAX_RECENT_HISTORY) {
      recentBlocks.shift();
    }

    // write back to the state.
    return {
      recentBlocks: Compatibility.isGreaterOrEqual(GpVersion.V0_6_7)
        ? RecentBlocks.create({
            blocks: asKnownSize(recentBlocks),
            accumulationLog: mmr.getPeaks(),
          })
        : asKnownSize(recentBlocks),
    };
  }
}
