import type { HeaderHash, StateRootHash } from "@typeberry/block";
import type { WorkPackageHash, WorkPackageInfo } from "@typeberry/block/work-report.js";
import { Bytes } from "@typeberry/bytes";
import { type HashDictionary, asKnownSize } from "@typeberry/collections";
import { HASH_SIZE, type KeccakHash, type OpaqueHash } from "@typeberry/hash";
import { MerkleMountainRange, type MmrHasher } from "@typeberry/mmr";
import {
  BlockState,
  LegacyBlockState,
  LegacyRecentBlocks,
  MAX_RECENT_HISTORY,
  RecentBlocks,
  RecentBlocksHistory,
  type State,
} from "@typeberry/state";
import { Compatibility, GpVersion } from "@typeberry/utils";

export type RecentHistoryPartialInput = {
  /** State root before current header. */
  priorStateRoot: StateRootHash;
};

/** Current block input for the recent history transition. */
export type RecentHistoryInput = {
  /** Result of the partial transition. */
  partial: RecentHistoryStateUpdate;
  /** Current header hash. */
  headerHash: HeaderHash;
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

  /**
   * During the accumulation stage, a value with the partial transition
   * of this state is provided which contains the update for the newly-known
   * roots of the parent block.
   *
   * β† ≡ β except β†[|β| − 1]_s = H_r
   *
   * https://graypaper.fluffylabs.dev/#/9a08063/0fd2010fe001?v=0.6.6
   */
  partialTransition(input: RecentHistoryPartialInput): RecentHistoryStateUpdate {
    const recentBlocks = this.state.recentBlocks.blocks.slice();
    const lastState = recentBlocks.length > 0 ? recentBlocks[recentBlocks.length - 1] : null;
    // update the posterior root of previous state.
    if (lastState !== null) {
      lastState.postStateRoot = input.priorStateRoot;
    }

    return {
      recentBlocks: asKnownSize(recentBlocks), // β†
    };
  }

  /**
   * https://graypaper.fluffylabs.dev/#/9a08063/0fe1010f9402?v=0.6.6
   */
  transition(input: RecentHistoryInput): RecentHistoryStateUpdate {
    const recentBlocks = this.state.recentBlocks.blocks.slice();
    const lastState = recentBlocks.length > 0 ? recentBlocks[recentBlocks.length - 1] : null;

    const mmr = Compatibility.isGreaterOrEqual(GpVersion.V0_6_7)
      ? this.state.recentBlocks.accumulationLog !== null
        ? MerkleMountainRange.fromPeaks(this.hasher, this.state.recentBlocks.accumulationLog)
        : MerkleMountainRange.empty(this.hasher)
      : lastState !== null
        ? MerkleMountainRange.fromPeaks(this.hasher, (lastState as LegacyBlockState).mmr)
        : MerkleMountainRange.empty(this.hasher);

    // append the accumulation root
    mmr.append(input.accumulateRoot);

    // push new state item
    if (Compatibility.isGreaterOrEqual(GpVersion.V0_6_7)) {
      recentBlocks.push(
        BlockState.create({
          headerHash: input.headerHash,
          accumulationResult: mmr.getSuperPeakHash(),
          postStateRoot: Bytes.zero(HASH_SIZE).asOpaque(),
          reported: input.workPackages,
        }),
      );
    } else {
      recentBlocks.push(
        LegacyBlockState.create({
          headerHash: input.headerHash,
          mmr: mmr.getPeaks(),
          postStateRoot: Bytes.zero(HASH_SIZE).asOpaque(),
          reported: input.workPackages,
        }),
      );
    }

    // we remove all items above `MAX_RECENT_HISTORY`.
    if (recentBlocks.length > MAX_RECENT_HISTORY) {
      recentBlocks.shift();
    }

    // write back to the state.
    return {
      recentBlocks: Compatibility.isGreaterOrEqual(GpVersion.V0_6_7)
        ? RecentBlocksHistory.create(
            RecentBlocks.create({
              blocks: asKnownSize(recentBlocks),
              accumulationLog: mmr.getPeaks(),
            }),
          )
        : RecentBlocksHistory.legacyCreate(LegacyRecentBlocks.create({ blocks: asKnownSize(recentBlocks) })),
    };
  }
}
