import type { HeaderHash, StateRootHash } from "@typeberry/block";
import { codecHashDictionary, codecKnownSizeArray } from "@typeberry/block/codec.js";
import { type WorkPackageHash, WorkPackageInfo } from "@typeberry/block/work-report.js";
import { type CodecRecord, codec, readonlyArray } from "@typeberry/codec";
import type { HashDictionary, KnownSizeArray } from "@typeberry/collections";
import { HASH_SIZE, type KeccakHash, type OpaqueHash } from "@typeberry/hash";
import type { MmrPeaks } from "@typeberry/mmr";
import { type Opaque, WithDebug } from "@typeberry/utils";
import { MAX_RECENT_HISTORY } from "./state.js";

/** Merkle Mountain Belt hash. */
export type MmbHash = Opaque<OpaqueHash, "MmbHash">;

/** Recent history of a single block. */
export class BlockState extends WithDebug {
  static Codec = codec.Class(BlockState, {
    headerHash: codec.bytes(HASH_SIZE).asOpaque<HeaderHash>(),
    accumulationResult: codec.bytes(HASH_SIZE).asOpaque<MmbHash>(),
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
    public readonly accumulationResult: MmbHash,
    /** Posterior state root filled in with a 1-block delay. */
    public postStateRoot: StateRootHash,
    /** Reported work packages (no more than number of cores). */
    public readonly reported: HashDictionary<WorkPackageHash, WorkPackageInfo>,
  ) {
    super();
  }
}

/**
 * Recent history of a single block and accumulation output log.
 *
 * https://graypaper.fluffylabs.dev/#/38c4e62/0f28020f2802?v=0.7.0
 */
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
    /** Most recent block. */
    public readonly blocks: KnownSizeArray<BlockState, `0..${typeof MAX_RECENT_HISTORY}`>,
    /** Accumulation output log. */
    public readonly accumulationLog: MmrPeaks<KeccakHash>,
  ) {
    super();
  }
}
