import type { HeaderHash, StateRootHash } from "@typeberry/block";
import type { ExportsRootHash, WorkPackageHash } from "@typeberry/block/work-report";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE, type OpaqueHash } from "@typeberry/hash";
import { MerkleMountainRange, type MmrHasher, type MmrPeaks } from "@typeberry/mmr";

/**
 * `H = 8`: The size of recent history, in blocks.
 *
 * https://graypaper.fluffylabs.dev/#/6e1c0cd/3f5d003f5f00
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
   * https://graypaper.fluffylabs.dev/#/6e1c0cd/173d03173f03
   */
  accumulateRoot: OpaqueHash;
  /** Work packages in the guarantees extrinsic. */
  workPackages: WorkPackageInfo[];
};

/**
 * `β`: State of the blocks from recent history.
 *
 * https://graypaper.fluffylabs.dev/#/6e1c0cd/0fb7010fb701
 */
export type RecentHistoryState = BlockState[];

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
 * https://graypaper.fluffylabs.dev/#/6e1c0cd/0faf010faf01
 */
export class RecentHistory {
  constructor(
    private readonly hasher: MmrHasher<OpaqueHash>,
    public readonly state: RecentHistoryState,
  ) {}

  transition(input: RecentHistoryInput) {
    const lastState = this.state.length > 0 ? this.state[this.state.length - 1] : null;
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
    this.state.push({
      headerHash: input.headerHash,
      mmr: mmr.getPeaks(),
      postStateRoot: Bytes.zero(HASH_SIZE).asOpaque(),
      reported: input.workPackages,
    });
    if (this.state.length > MAX_RECENT_HISTORY) {
      this.state.shift();
    }
  }
}
