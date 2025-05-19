import type { HeaderHash, StateRootHash } from "@typeberry/block";
import { codecHashDictionary } from "@typeberry/block/codec.js";
import { type WorkPackageHash, WorkPackageInfo } from "@typeberry/block/work-report.js";
import { type CodecRecord, codec } from "@typeberry/codec";
import type { HashDictionary } from "@typeberry/collections";
import { HASH_SIZE, type KeccakHash } from "@typeberry/hash";
import type { MmrPeaks } from "@typeberry/mmr";
import { WithDebug } from "@typeberry/utils";

/** Recent history of a single block. */
export class BlockState extends WithDebug {
  static Codec = codec.Class(BlockState, {
    headerHash: codec.bytes(HASH_SIZE).asOpaque<HeaderHash>(),
    mmr: codec.object({
      peaks: codec.sequenceVarLen(codec.optional(codec.bytes(HASH_SIZE))),
    }),
    postStateRoot: codec.bytes(HASH_SIZE).asOpaque<StateRootHash>(),
    reported: codecHashDictionary(WorkPackageInfo.Codec, (x) => x.workPackageHash),
  });

  static create({ headerHash, mmr, postStateRoot, reported }: CodecRecord<BlockState>) {
    return new BlockState(headerHash, mmr, postStateRoot, reported);
  }

  private constructor(
    /** Header hash. */
    public readonly headerHash: HeaderHash,
    /** Merkle mountain range peaks. */
    public readonly mmr: MmrPeaks<KeccakHash>,
    /** Posterior state root filled in with a 1-block delay. */
    public postStateRoot: StateRootHash,
    /** Reported work packages (no more than number of cores). */
    public readonly reported: HashDictionary<WorkPackageHash, WorkPackageInfo>,
  ) {
    super();
  }
}
