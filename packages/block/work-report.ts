import type { BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, codec } from "@typeberry/codec";
import { FixedSizeArray } from "@typeberry/collections";
import { HASH_SIZE, type OpaqueHash } from "@typeberry/hash";
import type { U16, U32 } from "@typeberry/numbers";
import { type Opaque, WithDebug } from "@typeberry/utils";
import type { CoreIndex, SegmentsRoot } from "./common";
import { RefineContext } from "./refine-context";
import { type WorkItemsCount, tryAsWorkItemsCount } from "./work-package";
import { WorkResult } from "./work-result";

/** Authorizer hash. */
export type AuthorizerHash = Opaque<OpaqueHash, "AuthorizerHash">;

/** Blake2B hash of a work package. */
export type WorkPackageHash = Opaque<OpaqueHash, "WorkPackageHash">;
/** Work package exported segments merkle root hash. */
export type ExportsRootHash = Opaque<OpaqueHash, "ExportsRootHash">;

/** Details about the work package being reported on. */
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
    /** The hash of the work package. */
    public readonly hash: WorkPackageHash,
    /** Encoded length of the work package. */
    public readonly length: U32,
    /** The root hash of the erasure coding merkle tree of that work package. */
    public readonly erasureRoot: OpaqueHash,
    /** The root hash of all data segments exported by this work package. */
    public readonly exportsRoot: ExportsRootHash,
    /** Encoded length of all data segments exported by this work package. */
    public readonly exportsCount: U16,
  ) {
    super();
  }
}

export class SegmentRootLookupItem {
  static Codec = codec.Class(SegmentRootLookupItem, {
    workPackageHash: codec.bytes(HASH_SIZE).asOpaque(),
    segmentTreeRoot: codec.bytes(HASH_SIZE).asOpaque(),
  });

  constructor(
    public workPackageHash: WorkPackageHash,
    public segmentTreeRoot: SegmentsRoot,
  ) {}

  static fromCodec({ workPackageHash, segmentTreeRoot }: CodecRecord<SegmentRootLookupItem>) {
    return new SegmentRootLookupItem(workPackageHash, segmentTreeRoot);
  }
}
/**
 * A report of execution of some work package.
 *
 * https://graypaper.fluffylabs.dev/#/c71229b/133e00134500
 */
export class WorkReport extends WithDebug {
  static Codec = codec.Class(WorkReport, {
    workPackageSpec: WorkPackageSpec.Codec,
    context: RefineContext.Codec,
    coreIndex: codec.u16.asOpaque(),
    authorizerHash: codec.bytes(HASH_SIZE).asOpaque(),
    authorizationOutput: codec.blob,
    segmentRootLookup: codec.sequenceVarLen(SegmentRootLookupItem.Codec),
    results: codec.sequenceVarLen(WorkResult.Codec).convert(
      (x) => x,
      (items) => FixedSizeArray.new(items, tryAsWorkItemsCount(items.length)),
    ),
  });

  static fromCodec({
    workPackageSpec,
    context,
    coreIndex,
    authorizerHash,
    authorizationOutput,
    segmentRootLookup,
    results,
  }: CodecRecord<WorkReport>) {
    return new WorkReport(
      workPackageSpec,
      context,
      coreIndex,
      authorizerHash,
      authorizationOutput,
      segmentRootLookup,
      results,
    );
  }

  constructor(
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
     * https://graypaper.fluffylabs.dev/#/911af30/13ab0013af00
     */
    public readonly segmentRootLookup: SegmentRootLookupItem[],
    /** `r`: The results of evaluation of each of the items in the work package. */
    public readonly results: FixedSizeArray<WorkResult, WorkItemsCount>,
  ) {
    super();
  }
}
