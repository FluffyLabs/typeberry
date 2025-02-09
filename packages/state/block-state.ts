// TODO [ToDr] Convert to class with codec.

import type { HeaderHash, StateRootHash } from "@typeberry/block";
import type { ExportsRootHash, WorkPackageHash } from "@typeberry/block/work-report";
import type { KeccakHash } from "@typeberry/hash";
import type { MmrPeaks } from "@typeberry/mmr";

/** Even more distilled version of [`WorkPackageSpec`]. */
export type WorkPackageInfo = {
  hash: WorkPackageHash;
  exportsRoot: ExportsRootHash;
};

/**
 * Recent history of a single block.
 */
export type BlockState = {
  /** Header hash. */
  headerHash: HeaderHash;
  /** Merkle mountain range peaks. */
  mmr: MmrPeaks<KeccakHash>;
  /** Posterior state root filled in with a 1-block delay. */
  postStateRoot: StateRootHash;
  /** Reported work packages (no more than number of cores). */
  reported: WorkPackageInfo[];
};
