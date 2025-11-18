import type { HeaderHash, StateRootHash } from "@typeberry/block";
import { codecHashDictionary, codecKnownSizeArray } from "@typeberry/block/codec.js";
import { type WorkPackageHash, WorkPackageInfo } from "@typeberry/block/refine-context.js";
import { type CodecRecord, codec, type DescribedBy } from "@typeberry/codec";
import { asKnownSize, type HashDictionary, type KnownSizeArray } from "@typeberry/collections";
import { HASH_SIZE, type KeccakHash } from "@typeberry/hash";
import type { MmrPeaks } from "@typeberry/mmr";
import { WithDebug } from "@typeberry/utils";

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

/**
 * Recent history of blocks.
 *
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/0fc9010fc901?v=0.6.7
 */
export class RecentBlocks extends WithDebug {
  static Codec = codec.Class(RecentBlocks, {
    blocks: codecKnownSizeArray(BlockState.Codec, {
      minLength: 0,
      maxLength: MAX_RECENT_HISTORY,
      typicalLength: MAX_RECENT_HISTORY,
    }),
    accumulationLog: codec.object({
      peaks: codec.readonlyArray(codec.sequenceVarLen(codec.optional(codec.bytes(HASH_SIZE)))),
    }),
  });

  static empty() {
    return new RecentBlocks(asKnownSize([]), {
      peaks: [],
    });
  }

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

export type RecentBlocksView = DescribedBy<typeof RecentBlocks.Codec.View>;
