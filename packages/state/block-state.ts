import type { HeaderHash, StateRootHash } from "@typeberry/block";
import { WorkPackageInfo } from "@typeberry/block/work-report";
import { type CodecRecord, codec } from "@typeberry/codec";
import { HASH_SIZE, type KeccakHash } from "@typeberry/hash";
import type { MmrPeaks } from "@typeberry/mmr";
import { WithDebug } from "@typeberry/utils";

/** Recent history of a single block. */
export class BlockState extends WithDebug {
  static Codec = codec.Class(BlockState, {
    headerHash: codec.bytes(HASH_SIZE).asOpaque(),
    mmr: codec.object({
      peaks: codec.sequenceVarLen(codec.optional(codec.bytes(HASH_SIZE))),
    }),
    postStateRoot: codec.bytes(HASH_SIZE).asOpaque(),
    reported: codec.sequenceVarLen(WorkPackageInfo.Codec),
  });

  static fromCodec({ headerHash, mmr, postStateRoot, reported }: CodecRecord<BlockState>) {
    return new BlockState(headerHash, mmr, postStateRoot, reported);
  }

  constructor(
    /** Header hash. */
    public readonly headerHash: HeaderHash,
    /** Merkle mountain range peaks. */
    public readonly mmr: MmrPeaks<KeccakHash>,
    /** Posterior state root filled in with a 1-block delay. */
    public postStateRoot: StateRootHash,
    /** Reported work packages (no more than number of cores). */
    public readonly reported: WorkPackageInfo[],
  ) {
    super();
  }
}
