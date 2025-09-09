import type { HeaderHash, StateRootHash } from "@typeberry/block";
import { codecHashDictionary, codecKnownSizeArray } from "@typeberry/block/codec.js";
import { type WorkPackageHash, WorkPackageInfo } from "@typeberry/block/refine-context.js";
import { type CodecRecord, Descriptor, codec, readonlyArray } from "@typeberry/codec";
import { type HashDictionary, type KnownSizeArray, asKnownSize } from "@typeberry/collections";
import { HASH_SIZE, type KeccakHash } from "@typeberry/hash";
import type { MmrPeaks } from "@typeberry/mmr";
import { WithDebug, asOpaqueType } from "@typeberry/utils";

/**
 * `H = 8`: The size of recent history, in blocks.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/416300416500
 */
export const MAX_RECENT_HISTORY = 8;
export type MAX_RECENT_HISTORY = typeof MAX_RECENT_HISTORY;

/** Array of recent blocks with maximum size of `MAX_RECENT_HISTORY` */
export type BlocksState = KnownSizeArray<BlockState, `0..${typeof MAX_RECENT_HISTORY}`>;

/** Recent history of a single block. */
export class BlockState extends WithDebug {
  static Codec = codec.Class(BlockState, {
    headerHash: codec.bytes(HASH_SIZE).asOpaque<HeaderHash>(),
    accumulationResult: codec.bytes(HASH_SIZE),
    postStateRoot: codec.bytes(HASH_SIZE).asOpaque<StateRootHash>(),
    reported: codecHashDictionary(WorkPackageInfo.Codec, (x) => x.workPackageHash),
  });

  static create({ headerHash, accumulationResult, postStateRoot, reported }: CodecRecord<BlockState>) {
    return new BlockState(headerHash, accumulationResult, postStateRoot, reported);
  }

  private constructor(
    /** Header hash. */
    public readonly headerHash: HeaderHash,
    /** Merkle mountain belt of accumulation result. */
    public readonly accumulationResult: KeccakHash,
    /** Posterior state root filled in with a 1-block delay. */
    public postStateRoot: StateRootHash,
    /** Reported work packages (no more than number of cores). */
    public readonly reported: HashDictionary<WorkPackageHash, WorkPackageInfo>,
  ) {
    super();
  }
}

export class RecentBlocks extends WithDebug {
  static Codec = codec.Class(RecentBlocks, {
    blocks: codecKnownSizeArray(BlockState.Codec, {
      minLength: 0,
      maxLength: MAX_RECENT_HISTORY,
      typicalLength: MAX_RECENT_HISTORY,
    }),
    accumulationLog: codec.object({
      peaks: readonlyArray(codec.sequenceVarLen(codec.optional(codec.bytes(HASH_SIZE)))),
    }),
  });

  static create(a: CodecRecord<RecentBlocks>) {
    return new RecentBlocks(a.blocks, a.accumulationLog);
  }

  private constructor(
    /**
     * Most recent blocks.
     * https://graypaper.fluffylabs.dev/#/7e6ff6a/0fea010fea01?v=0.6.7
     */
    public readonly blocks: BlocksState,
    /**
     * Accumulation output log.
     * https://graypaper.fluffylabs.dev/#/7e6ff6a/0f02020f0202?v=0.6.7
     */
    public readonly accumulationLog: MmrPeaks<KeccakHash>,
  ) {
    super();
  }
}

/**
 * Recent history of blocks.
 *
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/0fc9010fc901?v=0.6.7
 */
export class RecentBlocksHistory extends WithDebug {
  static Codec = Descriptor.new<RecentBlocksHistory>(
    "RecentBlocksHistory",
    RecentBlocks.Codec.sizeHint,
    (encoder, value) => RecentBlocks.Codec.encode(encoder, value.asCurrent()),
    (decoder) => {
      const recentBlocks = RecentBlocks.Codec.decode(decoder);
      return RecentBlocksHistory.create(recentBlocks);
    },
    (skip) => {
      return RecentBlocks.Codec.skip(skip);
    },
  );

  static create(recentBlocks: RecentBlocks) {
    return new RecentBlocksHistory(recentBlocks);
  }

  static empty() {
    return RecentBlocksHistory.create(
      RecentBlocks.create({
        blocks: asKnownSize([]),
        accumulationLog: { peaks: [] },
      }),
    );
  }

  /**
   * Returns the block's BEEFY super peak.
   */
  static accumulationResult(block: BlockState): KeccakHash {
    return (block as BlockState).accumulationResult;
  }

  private constructor(private readonly current: RecentBlocks | null) {
    super();
  }

  /** History of recent blocks with maximum size of `MAX_RECENT_HISTORY` */
  get blocks(): readonly BlockState[] {
    if (this.current !== null) {
      return this.current.blocks;
    }

    throw new Error("RecentBlocksHistory is in invalid state");
  }

  asCurrent() {
    if (this.current === null) {
      throw new Error("Cannot access current RecentBlocks format");
    }
    return this.current;
  }

  updateBlocks(blocks: BlockState[]): RecentBlocksHistory {
    if (this.current !== null) {
      return RecentBlocksHistory.create(
        RecentBlocks.create({
          ...this.current,
          blocks: asOpaqueType(blocks as BlockState[]),
        }),
      );
    }

    throw new Error("RecentBlocksHistory is in invalid state. Cannot be updated!");
  }
}
