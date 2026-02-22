import type { HeaderHash } from "@typeberry/block";
import type { BlocksDb } from "@typeberry/database";
import { Logger } from "@typeberry/logger";

const logger = Logger.new(import.meta.filename, "finality");

/** Result returned when a new block is finalized. */
export interface FinalityResult {
  /** The newly finalized block hash. */
  finalizedHash: HeaderHash;
  /** Block hashes whose states are no longer needed and can be pruned. */
  prunableStateHashes: HeaderHash[];
}

/** An abstraction for deciding which blocks are finalized. */
export interface Finalizer {
  /** Called after block import. Returns finality info if a new block was finalized, or null. */
  onBlockImported(headerHash: HeaderHash): FinalityResult | null;
}

/** An ordered sequence of block hashes forming a chain segment. */
type Chain = HeaderHash[];

/**
 * A simple finalizer that considers a block finalized when N blocks
 * have been built on top of it.
 *
 * Maintains an array of fork chains starting from the last finalized block.
 * When any chain reaches `depth`, the earliest blocks are finalized and
 * dead forks (branching from before the finalized point) are discarded.
 */
export class DummyFinalizer implements Finalizer {
  private lastFinalizedHash: HeaderHash;
  private unfinalized: Chain[] = [];

  constructor(
    private readonly blocks: BlocksDb,
    private readonly depth: number,
  ) {
    this.lastFinalizedHash = blocks.getBestHeaderHash();
    logger.info`🦭 Dummy Finalizer running with depth=${depth}`;
  }

  onBlockImported(headerHash: HeaderHash): FinalityResult | null {
    const header = this.blocks.getHeader(headerHash);
    if (header === null) {
      return null;
    }

    const parentHash = header.parentHeaderHash.materialize();

    // Try to attach the block to an existing chain at its tip.
    let extendedChain: Chain | null = null;
    for (const chain of this.unfinalized) {
      if (chain.length > 0 && chain[chain.length - 1].isEqualTo(parentHash)) {
        chain.push(headerHash);
        extendedChain = chain;
        break;
      }
    }

    if (extendedChain === null) {
      if (this.lastFinalizedHash.isEqualTo(parentHash)) {
        // Parent is the finalized block — start a new chain.
        const newChain: Chain = [headerHash];
        this.unfinalized.push(newChain);
        extendedChain = newChain;
      } else {
        // Fork from the middle of an existing chain — copy the prefix and branch.
        for (const chain of this.unfinalized) {
          const forkIdx = chain.findIndex((h) => h.isEqualTo(parentHash));
          if (forkIdx !== -1) {
            const newChain: Chain = [...chain.slice(0, forkIdx + 1), headerHash];
            this.unfinalized.push(newChain);
            extendedChain = newChain;
            break;
          }
        }
      }
    }

    if (extendedChain === null) {
      // Orphan block — cannot attach to any known chain.
      return null;
    }

    // Check if the extended chain is long enough to trigger finality.
    // A chain of length N has N-1 blocks built on top of chain[0].
    // We finalize chain[0] when there are >= depth blocks after it,
    // i.e. chain.length > depth.
    if (extendedChain.length <= this.depth) {
      return null;
    }

    // The newly finalized block sits at index (length - 1 - depth).
    const finalizedIdx = extendedChain.length - 1 - this.depth;
    const finalizedHash = extendedChain[finalizedIdx];

    // Collect prunable hashes and rebuild the unfinalized set.
    // The previously finalized block's state is no longer needed.
    const prunable: HeaderHash[] = [this.lastFinalizedHash];
    const newUnfinalized: Chain[] = [];

    for (const chain of this.unfinalized) {
      // Find the finalized block in this chain.
      const finIdx = chain.findIndex((h) => h.isEqualTo(finalizedHash));

      if (finIdx !== -1) {
        // Chain contains the finalized block — it's still alive.
        // Prune states for blocks before the finalized block.
        for (let i = 0; i < finIdx; i++) {
          prunable.push(chain[i]);
        }
        // Keep blocks after the finalized block.
        const remaining = chain.slice(finIdx + 1);
        if (remaining.length > 0) {
          newUnfinalized.push(remaining);
        }
      } else {
        // Dead fork — branches from a block that is no longer finalized.
        // Prune all its states.
        for (const h of chain) {
          prunable.push(h);
        }
      }
    }

    this.lastFinalizedHash = finalizedHash;
    this.unfinalized = newUnfinalized;

    return { finalizedHash, prunableStateHashes: prunable };
  }
}
