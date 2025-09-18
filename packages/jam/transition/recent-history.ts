import type { HeaderHash, StateRootHash } from "@typeberry/block";
import type { WorkPackageHash, WorkPackageInfo } from "@typeberry/block/refine-context.js";
import { Bytes } from "@typeberry/bytes";
import { asKnownSize, type HashDictionary } from "@typeberry/collections";
import { HASH_SIZE, type KeccakHash } from "@typeberry/hash";
import { MerkleMountainRange, type MmrHasher } from "@typeberry/mmr";
import { BlockState, MAX_RECENT_HISTORY, RecentBlocks, RecentBlocksHistory, type State } from "@typeberry/state";
import type { AccumulateRoot } from "./accumulate/accumulate-state.js";

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
   * Accumulation root calculated from `θ`: accumulation-output
   * using the basic binary Merklization function (M_B , defined in appendix E)
   *
   * https://graypaper.fluffylabs.dev/#/1c979cb/0f70020f7202?v=0.7.1
   */
  accumulateRoot: AccumulateRoot;
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
   * β_H† ≡ β_H except β_H†[|β_H| − 1]_s = H_r
   *
   * https://graypaper.fluffylabs.dev/#/1c979cb/0f55020f5502?v=0.7.1
   */
  partialTransition(input: RecentHistoryPartialInput): RecentHistoryStateUpdate {
    const recentBlocks = this.state.recentBlocks.blocks.slice();
    const lastState = recentBlocks.length > 0 ? recentBlocks[recentBlocks.length - 1] : null;
    // update the posterior root of previous state.
    if (lastState !== null) {
      lastState.postStateRoot = input.priorStateRoot;
    }

    return {
      recentBlocks: this.state.recentBlocks.updateBlocks(recentBlocks), // β_H†
    };
  }

  /**
   * `β′` = `β_H†` ++ (p, h: H(H), s: H_0, b: M_r(β′_B))
   * where p = { (((g_r)_s)_p ↦ ((g_r)_s)_e) | g ∈ EG }
   *
   * https://graypaper.fluffylabs.dev/#/1c979cb/0fd2020fd202?v=0.7.1
   */
  transition(input: RecentHistoryInput): RecentHistoryStateUpdate {
    const recentBlocks = input.partial.recentBlocks.blocks.slice();

    // `β′_B`
    const mmr =
      this.state.recentBlocks.asCurrent().accumulationLog !== null
        ? MerkleMountainRange.fromPeaks(this.hasher, this.state.recentBlocks.asCurrent().accumulationLog)
        : MerkleMountainRange.empty(this.hasher);

    // append the accumulation root
    mmr.append(input.accumulateRoot);
    const peaks = mmr.getPeaks();

    // push new state item
    recentBlocks.push(
      BlockState.create({
        headerHash: input.headerHash,
        accumulationResult: mmr.getSuperPeakHash(),
        postStateRoot: Bytes.zero(HASH_SIZE).asOpaque(),
        reported: input.workPackages,
      }),
    );

    // we remove all items above `MAX_RECENT_HISTORY`.
    if (recentBlocks.length > MAX_RECENT_HISTORY) {
      recentBlocks.shift();
    }

    // write back to the state.
    return {
      recentBlocks: RecentBlocksHistory.create(
        RecentBlocks.create({
          blocks: asKnownSize(recentBlocks),
          accumulationLog: peaks,
        }),
      ),
    };
  }
}
