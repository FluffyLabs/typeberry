import type { Bytes, BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, codec } from "@typeberry/codec";
import type { FixedSizeArray } from "@typeberry/collections";
import type { U16, U32 } from "@typeberry/numbers";
import type { Opaque } from "@typeberry/utils";
import { HASH_SIZE } from "./hash";
import { RefineContext } from "./refine-context";
import { WorkResult } from "./work-result";

export type CoreIndex = Opaque<U16, "CoreIndex[u16]">;
/** Blake2B hash of a work package. */
export type WorkPackageHash = Opaque<Bytes<typeof HASH_SIZE>, "WorkPackageHash">;

/** Details about the work package being reported on. */
export class WorkPackageSpec {
  static Codec = codec.Class(WorkPackageSpec, {
    hash: codec.bytes(HASH_SIZE).cast(),
    len: codec.u32,
    erasureRoot: codec.bytes(HASH_SIZE),
    exportsRoot: codec.bytes(HASH_SIZE),
  });

  static fromCodec({ hash, len, erasureRoot, exportsRoot }: CodecRecord<WorkPackageSpec>) {
    return new WorkPackageSpec(hash, len, erasureRoot, exportsRoot);
  }

  constructor(
    /** The hash of the work package. */
    public readonly hash: WorkPackageHash,
    /** Encoded length of the work package. */
    public readonly len: U32,
    /** The root hash of the erasure coding merkle tree of that work package. */
    public readonly erasureRoot: Bytes<typeof HASH_SIZE>,
    /** The root hash of all data segments exported by this work package. */
    public readonly exportsRoot: Bytes<typeof HASH_SIZE>,
  ) {}
}

export class WorkReport {
  static Codec = codec.Class(WorkReport, {
    packageSpec: WorkPackageSpec.Codec,
    context: RefineContext.Codec,
    coreIndex: codec.u16.cast(),
    authorizerHash: codec.bytes(HASH_SIZE),
    authOutput: codec.blob,
    // TODO [ToDr] Constrain the size of the sequence during decoding.
    results: codec.sequenceVarLen(WorkResult.Codec).cast(),
  });

  static fromCodec({ packageSpec, context, coreIndex, authorizerHash, authOutput, results }: CodecRecord<WorkReport>) {
    return new WorkReport(packageSpec, context, coreIndex, authorizerHash, authOutput, results);
  }

  constructor(
    public readonly packageSpec: WorkPackageSpec,
    public readonly context: RefineContext,
    public readonly coreIndex: CoreIndex,
    public readonly authorizerHash: Bytes<typeof HASH_SIZE>,
    public readonly authOutput: BytesBlob,
    public readonly results: FixedSizeArray<WorkResult, 1 | 2 | 3 | 4>,
  ) {}
}
