import type { HeaderHash, StateRootHash } from "@typeberry/block";
import { codecHashDictionary } from "@typeberry/block/codec.js";
import { type WorkPackageHash, WorkPackageInfo } from "@typeberry/block/work-report.js";
import { type CodecRecord, codec } from "@typeberry/codec";
import type { HashDictionary } from "@typeberry/collections";
import { HASH_SIZE, type OpaqueHash } from "@typeberry/hash";
import { WithDebug } from "@typeberry/utils";

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
    /**
     * Accumulation result
     *
     * TODO: [MaSo] change it to correct hash type
     */
    public readonly accumulationResult: OpaqueHash,
    /** Posterior state root filled in with a 1-block delay. */
    public postStateRoot: StateRootHash,
    /** Reported work packages (no more than number of cores). */
    public readonly reported: HashDictionary<WorkPackageHash, WorkPackageInfo>,
  ) {
    super();
  }
}
