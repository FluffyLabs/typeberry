import type { HeaderHash, StateRootHash } from "@typeberry/block";
import { codecHashDictionary, codecKnownSizeArray } from "@typeberry/block/codec.js";
import { type WorkPackageHash, WorkPackageInfo } from "@typeberry/block/work-report.js";
import { type CodecRecord, codec, readonlyArray } from "@typeberry/codec";
import type { HashDictionary, KnownSizeArray } from "@typeberry/collections";
import { HASH_SIZE, type KeccakHash } from "@typeberry/hash";
import type { MmrPeaks } from "@typeberry/mmr";
import { WithDebug } from "@typeberry/utils";
import { MAX_RECENT_HISTORY } from "./state.js";

/** Array of recent blocks with maximum size of `MAX_RECENT_HISTORY` */
export type RecentBlockStates = KnownSizeArray<RecentBlockState, `0..${typeof MAX_RECENT_HISTORY}`>;

/** Recent history of a single block. */
export class RecentBlockState extends WithDebug {
  static Codec = codec.Class(RecentBlockState, {
    headerHash: codec.bytes(HASH_SIZE).asOpaque<HeaderHash>(),
    accumulationResult: codec.bytes(HASH_SIZE),
    postStateRoot: codec.bytes(HASH_SIZE).asOpaque<StateRootHash>(),
    reported: codecHashDictionary(WorkPackageInfo.Codec, (x) => x.workPackageHash),
  });

  static create({ headerHash, accumulationResult, postStateRoot, reported }: CodecRecord<RecentBlockState>) {
    return new RecentBlockState(headerHash, accumulationResult, postStateRoot, reported);
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
 * Recent history of blocks and accumulation output log.
 *
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/0fc9010fc901?v=0.6.7
 */
export class RecentBlocks extends WithDebug {
  static Codec = codec.Class(RecentBlocks, {
    blocks: codecKnownSizeArray(RecentBlockState.Codec, {
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
     * Most recent block.
     * https://graypaper.fluffylabs.dev/#/7e6ff6a/0fea010fea01?v=0.6.7
     */
    public readonly blocks: RecentBlockStates,
    /**
     * Accumulation output log.
     * https://graypaper.fluffylabs.dev/#/7e6ff6a/0f02020f0202?v=0.6.7
     * TODO: [MaSo] Change to MMB to align with GP.
     */
    public readonly accumulationLog: MmrPeaks<KeccakHash>,
  ) {
    super();
  }
}
