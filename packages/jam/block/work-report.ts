import type { BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, codec, readonlyArray } from "@typeberry/codec";
import { FixedSizeArray } from "@typeberry/collections";
import { HASH_SIZE, type OpaqueHash } from "@typeberry/hash";
import { type U16, type U32, isU16, tryAsU32 } from "@typeberry/numbers";
import { type Opaque, TestSuite, WithDebug } from "@typeberry/utils";
import { Compatibility, GpVersion } from "@typeberry/utils";
import { type CoreIndex, type ServiceGas, tryAsCoreIndex } from "./common.js";
import { RefineContext } from "./refine-context.js";
import { type WorkItemsCount, tryAsWorkItemsCount } from "./work-package.js";
import { WorkResult } from "./work-result.js";

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
    hash: codec.bytes(HASH_SIZE).asOpaque<WorkPackageHash>(),
    length: codec.u32,
    erasureRoot: codec.bytes(HASH_SIZE),
    exportsRoot: codec.bytes(HASH_SIZE).asOpaque<ExportsRootHash>(),
    exportsCount: codec.u16,
  });

  static create({ hash, length, erasureRoot, exportsRoot, exportsCount }: CodecRecord<WorkPackageSpec>) {
    return new WorkPackageSpec(hash, length, erasureRoot, exportsRoot, exportsCount);
  }

  private constructor(
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
    workPackageHash: codec.bytes(HASH_SIZE).asOpaque<WorkPackageHash>(),
    segmentTreeRoot: codec.bytes(HASH_SIZE).asOpaque<ExportsRootHash>(),
  });

  private constructor(
    /** Hash of the described work package. */
    readonly workPackageHash: WorkPackageHash,
    /** Exports root hash. */
    readonly segmentTreeRoot: ExportsRootHash,
  ) {
    super();
  }

  static create({ workPackageHash, segmentTreeRoot }: CodecRecord<WorkPackageInfo>) {
    return new WorkPackageInfo(workPackageHash, segmentTreeRoot);
  }
}

/**
 * A report of execution of some work package.
 *
 * https://graypaper.fluffylabs.dev/#/cc517d7/131c01132401?v=0.6.5
 */
export class WorkReportNoCodec extends WithDebug {
  static create({
    workPackageSpec,
    context,
    coreIndex,
    authorizerHash,
    authorizationOutput,
    segmentRootLookup,
    results,
    authorizationGasUsed,
  }: CodecRecord<WorkReportNoCodec>) {
    return new WorkReportNoCodec(
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

  protected constructor(
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
    public readonly segmentRootLookup: readonly WorkPackageInfo[],
    /** `r`: The results of evaluation of each of the items in the work package. */
    public readonly results: FixedSizeArray<WorkResult, WorkItemsCount>,
    /** `g`: Gas used during authorization. */
    public readonly authorizationGasUsed: ServiceGas,
  ) {
    super();
  }
}

const WorkReportCodec = codec.Class(WorkReportNoCodec, {
  workPackageSpec: WorkPackageSpec.Codec,
  context: RefineContext.Codec,
  coreIndex: codec.varU32.convert(
    (o) => tryAsU32(o),
    (i) => {
      if (!isU16(i)) {
        throw new Error(`Core index exceeds U16: ${i}`);
      }
      return tryAsCoreIndex(i);
    },
  ),
  authorizerHash: codec.bytes(HASH_SIZE).asOpaque<AuthorizerHash>(),
  authorizationGasUsed: codec.varU64.asOpaque<ServiceGas>(),
  authorizationOutput: codec.blob,
  segmentRootLookup: readonlyArray(codec.sequenceVarLen(WorkPackageInfo.Codec)),
  results: codec.sequenceVarLen(WorkResult.Codec).convert(
    (x) => x,
    (items) => FixedSizeArray.new(items, tryAsWorkItemsCount(items.length)),
  ),
});

const WorkReportCodecPre070 = codec.Class(WorkReportNoCodec, {
  workPackageSpec: WorkPackageSpec.Codec,
  context: RefineContext.Codec,
  coreIndex:
    Compatibility.isGreaterOrEqual(GpVersion.V0_6_5) && !Compatibility.isSuite(TestSuite.JAMDUNA, GpVersion.V0_6_5)
      ? codec.varU32.convert(
          (o) => tryAsU32(o),
          (i) => {
            if (!isU16(i)) {
              throw new Error(`Core index exceeds U16: ${i}`);
            }
            return tryAsCoreIndex(i);
          },
        )
      : codec.u16.asOpaque<CoreIndex>(),
  authorizerHash: codec.bytes(HASH_SIZE).asOpaque<AuthorizerHash>(),
  authorizationOutput: codec.blob,
  segmentRootLookup: readonlyArray(codec.sequenceVarLen(WorkPackageInfo.Codec)),
  results: codec.sequenceVarLen(WorkResult.Codec).convert(
    (x) => x,
    (items) => FixedSizeArray.new(items, tryAsWorkItemsCount(items.length)),
  ),
  authorizationGasUsed: codec.varU64.asOpaque<ServiceGas>(),
});

export class WorkReport extends WorkReportNoCodec {
  static Codec: typeof WorkReportCodec = Compatibility.isGreaterOrEqual(GpVersion.V0_7_0)
    ? WorkReportCodec
    : WorkReportCodecPre070;
}
