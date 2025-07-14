import { codecKnownSizeArray } from "@typeberry/block/codec.js";
import { type CodecRecord, codec, readonlyArray } from "@typeberry/codec";
import type { KnownSizeArray } from "@typeberry/collections";
import { HASH_SIZE, type KeccakHash } from "@typeberry/hash";
import type { MmrPeaks } from "@typeberry/mmr";
import { WithDebug } from "@typeberry/utils";
import { BlockState } from "./block-state.js";
import { MAX_RECENT_HISTORY } from "./state.js";

/** History of recent blocks. */
export class RecentBlocks extends WithDebug {
  static Codec = codec.Class(RecentBlocks, {
    blocks: codecKnownSizeArray(BlockState.Codec, {
      minLength: 0,
      maxLength: MAX_RECENT_HISTORY,
      typicalLength: MAX_RECENT_HISTORY,
    }),
    mmr: codec.object({
      peaks: readonlyArray(codec.sequenceVarLen(codec.optional(codec.bytes(HASH_SIZE)))),
    }),
  });

  static create(r: CodecRecord<RecentBlocks>) {
    return new RecentBlocks(r.blocks, r.mmr);
  }

  private constructor(
    /** All of recent blocks. */
    public readonly blocks: KnownSizeArray<BlockState, `[0..${typeof MAX_RECENT_HISTORY})`>,
    /** Accumulation MMR of output log. */
    public readonly mmr: MmrPeaks<KeccakHash>,
  ) {
    super();
  }
}
