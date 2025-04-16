import type { BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, codec } from "@typeberry/codec";
import { FixedSizeArray } from "@typeberry/collections";
import { HASH_SIZE, type OpaqueHash } from "@typeberry/hash";
import type { U16, U32 } from "@typeberry/numbers";
import { type Opaque, WithDebug } from "@typeberry/utils";
import type { CoreIndex, ServiceGas } from "./common";
import { RefineContext } from "./refine-context";
import { type WorkItemsCount, tryAsWorkItemsCount } from "./work-package";
import { WorkResult } from "./work-result";

/** Authorizer hash. */
export type AuthorizerHash = Opaque<OpaqueHash, "AuthorizerHash">;

/** Blake2B hash of a work package. */
export type WorkPackageHash = Opaque<OpaqueHash, "WorkPackageHash">;
/** Work package exported segments merkle root hash. */
export type ExportsRootHash = Opaque<OpaqueHash, "ExportsRootHash">;

/**
 * Details about the work package being reported on.
 *
 * https://graypaper.fluffylabs.dev/#/5f542d7/130e01130e01?v=0.6.2
 */
export class WorkPackageSpec extends WithDebug {
  static Codec = codec.Class(WorkPackageSpec, {
    hash: codec.bytes(HASH_SIZE).asOpaque(),
    length: codec.u32,
    erasureRoot: codec.bytes(HASH_SIZE),
    exportsRoot: codec.bytes(HASH_SIZE).asOpaque(),
    exportsCount: codec.u16,
  });

  static fromCodec({ hash, length, erasureRoot, exportsRoot, exportsCount }: CodecRecord<WorkPackageSpec>) {
    return new WorkPackageSpec(hash, length, erasureRoot, exportsRoot, exportsCount);
  }

  constructor(
    /** `h`: The hash of the work package. */
    public readonly hash: WorkPackageHash,
    /** `l`: Auditable work-bundle length. */
    public readonly length: U32,
    /** `u`: The root hash of the erasure coding merkle tree of that work package. */
    public readonly erasureRoot: OpaqueHash,
    /** `e`: The root hash of all data segments exported by this work package. */
    public readonly exportsRoot: ExportsRootHash,
    /** `n`: Number of segments exported by this work package. */
    public readonly exportsCount: U16,
  ) {
    super();
  }
}

/**
 * Mapping between work package hash and root hash of it's exports.
 *
 * Used to construct a dictionary.
 */
export class WorkPackageInfo extends WithDebug {
  static Codec = codec.Class(WorkPackageInfo, {
    workPackageHash: codec.bytes(HASH_SIZE).asOpaque(),
    segmentTreeRoot: codec.bytes(HASH_SIZE).asOpaque(),
  });

  constructor(
    /** Hash of the described work package. */
    readonly workPackageHash: WorkPackageHash,
    /** Exports root hash. */
    readonly segmentTreeRoot: ExportsRootHash,
  ) {
    super();
  }

  static fromCodec({ workPackageHash, segmentTreeRoot }: CodecRecord<WorkPackageInfo>) {
    return new WorkPackageInfo(workPackageHash, segmentTreeRoot);
  }
}

/**
 * A report of execution of some work package.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/136f00137600
 */
export class WorkReport extends WithDebug {
  static Codec = codec.Class(WorkReport, {
    workPackageSpec: WorkPackageSpec.Codec,
    context: RefineContext.Codec,
    coreIndex: codec.u16.asOpaque(),
    authorizerHash: codec.bytes(HASH_SIZE).asOpaque(),
    authorizationOutput: codec.blob,
    segmentRootLookup: codec.sequenceVarLen(WorkPackageInfo.Codec),
    results: codec.sequenceVarLen(WorkResult.Codec).convert(
      (x) => x,
      (items) => FixedSizeArray.new(items, tryAsWorkItemsCount(items.length)),
    ),
    authorizationGasUsed: codec.varU64.asOpaque(),
  });

  static fromCodec({
    workPackageSpec,
    context,
    coreIndex,
    authorizerHash,
    authorizationOutput,
    segmentRootLookup,
    results,
    authorizationGasUsed,
  }: CodecRecord<WorkReport>) {
    return new WorkReport(
      workPackageSpec,
      context,
      coreIndex,
      authorizerHash,
      authorizationOutput,
      segmentRootLookup,
      results,
      authorizationGasUsed,
    );
  }

  private constructor(
    /** `s`: Work package specification. */
    public readonly workPackageSpec: WorkPackageSpec,
    /** `x`: Refinement context. */
    public readonly context: RefineContext,
    /** `c`: Core index on which the work is done. */
    public readonly coreIndex: CoreIndex,
    /** `a`: Hash of the authorizer. */
    public readonly authorizerHash: AuthorizerHash,
    /** `o`: Authorization output. */
    public readonly authorizationOutput: BytesBlob,
    /** `l`: Segment-root lookup
     * In GP segment-root lookup is a dictionary but dictionary and var-len sequence are equal from codec perspective
     * https://graypaper.fluffylabs.dev/#/579bd12/13ab0013ad00
     */
    public readonly segmentRootLookup: WorkPackageInfo[],
    /** `r`: The results of evaluation of each of the items in the work package. */
    public readonly results: FixedSizeArray<WorkResult, WorkItemsCount>,
    /** `g`: Gas used during authorization. */
    public readonly authorizationGasUsed: ServiceGas,
  ) {
    super();
  }
}
