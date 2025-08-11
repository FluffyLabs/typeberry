import type { HeaderHash, StateRootHash } from "@typeberry/block";
import { codecHashDictionary, codecKnownSizeArray } from "@typeberry/block/codec.js";
import { type WorkPackageHash, WorkPackageInfo } from "@typeberry/block/work-report.js";
import { type CodecRecord, Descriptor, codec, readonlyArray } from "@typeberry/codec";
import { type HashDictionary, type KnownSizeArray, asKnownSize } from "@typeberry/collections";
import { HASH_SIZE, type KeccakHash } from "@typeberry/hash";
import { MerkleMountainRange, type MmrHasher, type MmrPeaks } from "@typeberry/mmr";
import { Compatibility, GpVersion, WithDebug, asOpaqueType } from "@typeberry/utils";

/**
 * `H = 8`: The size of recent history, in blocks.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/416300416500
 */
export const MAX_RECENT_HISTORY = 8;
export type MAX_RECENT_HISTORY = typeof MAX_RECENT_HISTORY;

export type LegacyBlocksState = KnownSizeArray<LegacyBlockState, `0..${typeof MAX_RECENT_HISTORY}`>;

export class LegacyBlockState extends WithDebug {
  static Codec = codec.Class(LegacyBlockState, {
    headerHash: codec.bytes(HASH_SIZE).asOpaque<HeaderHash>(),
    mmr: codec.object({
      peaks: readonlyArray(codec.sequenceVarLen(codec.optional(codec.bytes(HASH_SIZE)))),
    }),
    postStateRoot: codec.bytes(HASH_SIZE).asOpaque<StateRootHash>(),
    reported: codecHashDictionary(WorkPackageInfo.Codec, (x) => x.workPackageHash),
  });

  static create({ headerHash, mmr, postStateRoot, reported }: CodecRecord<LegacyBlockState>) {
    return new LegacyBlockState(headerHash, mmr, postStateRoot, reported);
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

export class LegacyRecentBlocks extends WithDebug {
  static Codec = codec.Class(LegacyRecentBlocks, {
    blocks: codecKnownSizeArray(LegacyBlockState.Codec, {
      minLength: 0,
      maxLength: MAX_RECENT_HISTORY,
      typicalLength: MAX_RECENT_HISTORY,
    }),
  });

  static create(a: CodecRecord<LegacyRecentBlocks>) {
    return new LegacyRecentBlocks(a.blocks);
  }

  private constructor(
    /**
     * Most recent blocks.
     * https://graypaper.fluffylabs.dev/#/85129da/0fb6010fb601?v=0.6.3
     */
    public readonly blocks: LegacyBlocksState,
  ) {
    super();
  }
}

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
 * Unified recent history of blocks that handles both legacy and current formats.
 *
 * https://graypaper.fluffylabs.dev/#/85129da/38cb0138cb01?v=0.6.3
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/0fc9010fc901?v=0.6.7
 */
export class RecentBlocksHistory extends WithDebug {
  static Codec = Descriptor.new<RecentBlocksHistory>(
    "RecentBlocksHistory",
    Compatibility.isGreaterOrEqual(GpVersion.V0_6_7) ? RecentBlocks.Codec.sizeHint : LegacyRecentBlocks.Codec.sizeHint,
    (encoder, value) =>
      Compatibility.isGreaterOrEqual(GpVersion.V0_6_7)
        ? RecentBlocks.Codec.encode(encoder, value.asCurrent())
        : LegacyRecentBlocks.Codec.encode(encoder, value.asLegacy()),
    (decoder) => {
      if (Compatibility.isGreaterOrEqual(GpVersion.V0_6_7)) {
        const recentBlocks = RecentBlocks.Codec.decode(decoder);
        return RecentBlocksHistory.create(recentBlocks);
      }
      const legacyBlocks = LegacyRecentBlocks.Codec.decode(decoder);
      return RecentBlocksHistory.legacyCreate(legacyBlocks);
    },
    (_sizer) => {
      return Compatibility.isGreaterOrEqual(GpVersion.V0_6_7)
        ? RecentBlocks.Codec.sizeHint
        : LegacyRecentBlocks.Codec.sizeHint;
    },
  );

  static create(recentBlocks: RecentBlocks) {
    return new RecentBlocksHistory(recentBlocks, null);
  }

  static legacyCreate(legacyRecentBlocks: LegacyRecentBlocks) {
    return new RecentBlocksHistory(null, legacyRecentBlocks);
  }

  static empty() {
    if (Compatibility.isGreaterOrEqual(GpVersion.V0_6_7)) {
      return RecentBlocksHistory.create(
        RecentBlocks.create({
          blocks: asKnownSize([]),
          accumulationLog: { peaks: [] },
        }),
      );
    }
    return RecentBlocksHistory.legacyCreate(LegacyRecentBlocks.create({ blocks: asKnownSize([]) }));
  }

  /**
   * Returns the block's BEEFY super peak.
   *
   * NOTE: The `hasher` parameter exists solely for backward compatibility with legacy block formats.
   */
  static accumulationResult(
    block: BlockState | LegacyBlockState,
    {
      hasher,
    }: {
      hasher: MmrHasher<KeccakHash>;
    },
  ): KeccakHash {
    return Compatibility.isGreaterOrEqual(GpVersion.V0_6_7)
      ? (block as BlockState).accumulationResult
      : MerkleMountainRange.fromPeaks(hasher, (block as LegacyBlockState).mmr).getSuperPeakHash();
  }

  private constructor(
    private readonly current: RecentBlocks | null,
    private readonly legacy: LegacyRecentBlocks | null,
  ) {
    super();
  }

  /** History of recent blocks with maximum size of `MAX_RECENT_HISTORY` */
  get blocks(): readonly (BlockState | LegacyBlockState)[] {
    if (Compatibility.isGreaterOrEqual(GpVersion.V0_6_7) && this.current !== null) {
      return this.current.blocks;
    }
    if (this.legacy !== null) {
      return this.legacy.blocks;
    }
    throw new Error("RecentBlocksHistory is in invalid state");
  }

  asCurrent() {
    if (this.current === null) {
      throw new Error("Cannot access current RecentBlocks format");
    }
    return this.current;
  }

  asLegacy() {
    if (this.legacy === null) {
      throw new Error("Cannot access legacy RecentBlocks format");
    }
    return this.legacy;
  }

  updateBlocks(blocks: (BlockState | LegacyBlockState)[]): RecentBlocksHistory {
    if (Compatibility.isGreaterOrEqual(GpVersion.V0_6_7) && this.current !== null) {
      return RecentBlocksHistory.create(
        RecentBlocks.create({
          ...this.current,
          blocks: asOpaqueType(blocks as BlockState[]),
        }),
      );
    }
    if (this.legacy !== null) {
      return RecentBlocksHistory.legacyCreate(
        LegacyRecentBlocks.create({
          blocks: asOpaqueType(blocks as LegacyBlockState[]),
        }),
      );
    }
    throw new Error("RecentBlocksHistory is in invalid state. Cannot be updated!");
  }
}
