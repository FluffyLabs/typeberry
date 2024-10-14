import type { Bytes, BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, codec } from "@typeberry/codec";
import type { FixedSizeArray } from "@typeberry/collections";
import type { U16, U32 } from "@typeberry/numbers";
import type { Opaque } from "@typeberry/utils";
import { HASH_SIZE } from "./hash";
import { RefineContext } from "./refine-context";
import type { WorkItemsCount } from "./work-package";
import { WorkResult } from "./work-result";

/** Index of the core on which the execution of the work package is done. */
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

/**
 * A report of execution of some work package.
 *
 * https://graypaper.fluffylabs.dev/#/c71229b/133e00134500
 */
export class WorkReport {
  static Codec = codec.Class(WorkReport, {
    workPackageSpec: WorkPackageSpec.Codec,
    context: RefineContext.Codec,
    coreIndex: codec.u16.cast(),
    authorizerHash: codec.bytes(HASH_SIZE),
    authorizationOutput: codec.blob,
    // TODO [ToDr] Constrain the size of the sequence during decoding.
    results: codec.sequenceVarLen(WorkResult.Codec).cast(),
  });

  static fromCodec({
    workPackageSpec,
    context,
    coreIndex,
    authorizerHash,
    authorizationOutput,
    results,
  }: CodecRecord<WorkReport>) {
    return new WorkReport(workPackageSpec, context, coreIndex, authorizerHash, authorizationOutput, results);
  }

  constructor(
    /** `s`: Work package specification. */
    public readonly workPackageSpec: WorkPackageSpec,
    /** `x`: Refinement context. */
    public readonly context: RefineContext,
    /** `c`: Core index on which the work is done. */
    public readonly coreIndex: CoreIndex,
    /** `a`: Hash of the authorizer. */
    public readonly authorizerHash: Bytes<typeof HASH_SIZE>,
    /** `o`: Authorization output. */
    public readonly authorizationOutput: BytesBlob,
    /**
     * TODO [ToDr] a segment-root lookup dictionary is mentioned in the GP but missing in JSON tests for now.
     * https://graypaper.fluffylabs.dev/#/c71229b/137a00137d00
     */
    // public readonly segmentRootLookup: MapOfHashes<Bytes<typeof HASH_SIZE>>,
    /** `r`: The results of evaluation of each of the items in the work package. */
    public readonly results: FixedSizeArray<WorkResult, WorkItemsCount>,
  ) {}
}
