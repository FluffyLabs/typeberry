import type { HeaderHash, StateRootHash } from "@typeberry/block";
import type { ExportsRootHash, WorkPackageHash } from "@typeberry/block/work-report";
import { Bytes } from "@typeberry/bytes";
import type { KnownSizeArray } from "@typeberry/collections";
import { HASH_SIZE, type OpaqueHash } from "@typeberry/hash";
import { MerkleMountainRange, type MmrHasher, type MmrPeaks } from "@typeberry/mmr";

/**
 * `H = 8`: The size of recent history, in blocks.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/416300416500
 */
export const MAX_RECENT_HISTORY = 8;

/** Even more distilled version of [`WorkPackageSpec`]. */
export type WorkPackageInfo = {
  hash: WorkPackageHash;
  exportsRoot: ExportsRootHash;
};

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
  workPackages: WorkPackageInfo[];
};

/** Recent history tests state. */
export type RecentHistoryState = {
  /**
   * `β`: State of the blocks from recent history.
   *
   * https://graypaper.fluffylabs.dev/#/579bd12/0fb7010fb701
   */
  recentBlocks: KnownSizeArray<BlockState, `0..${typeof MAX_RECENT_HISTORY}`>;
};

/**
 * Recent history of a single block.
 */
export type BlockState = {
  /** Header hash. */
  headerHash: HeaderHash;
  /** Merkle mountain range peaks. */
  mmr: MmrPeaks<OpaqueHash>;
  /** Posterior state root filled in with a 1-block delay. */
  postStateRoot: StateRootHash;
  /** Reported work packages (no more than number of cores). */
  reported: WorkPackageInfo[];
};

/**
 * Recent History transition function.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/0faf010faf01
 */
export class RecentHistory {
  constructor(
    private readonly hasher: MmrHasher<OpaqueHash>,
    public readonly state: RecentHistoryState,
  ) {}

  transition(input: RecentHistoryInput) {
    const { recentBlocks } = this.state;
    const lastState = recentBlocks.length > 0 ? recentBlocks[recentBlocks.length - 1] : null;
    // update the posterior root of previous state.
    if (lastState) {
      lastState.postStateRoot = input.priorStateRoot;
    }

    const mmr = lastState
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
    this.state.recentBlocks = recentBlocks;
  }
}
