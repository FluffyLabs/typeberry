import type { Bytes, BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, codec } from "@typeberry/codec";
import type { KnownSizeArray } from "@typeberry/collections";
import { HASH_SIZE, type OpaqueHash } from "@typeberry/hash";
import { type U16, type U32, sumU32 } from "@typeberry/numbers";
import { type Opaque, WithDebug, asOpaqueType } from "@typeberry/utils";
import type { ServiceGas, ServiceId } from "./common";
import type { CodeHash } from "./hash";
import type { MAX_NUMBER_OF_SEGMENTS, SegmentIndex } from "./work-item-segment";

type WorkItemExtrinsicHash = Opaque<OpaqueHash, "ExtrinsicHash">;

/**
 * Definition of data segment that was exported by some work package earlier
 * and now is being imported by another work-item.
 */
export class ImportSpec extends WithDebug {
  static Codec = codec.Class(ImportSpec, {
    treeRoot: codec.bytes(HASH_SIZE),
    index: codec.u16.asOpaque(),
  });

  static fromCodec({ treeRoot, index }: CodecRecord<ImportSpec>) {
    return new ImportSpec(treeRoot, index);
  }

  constructor(
    /**
     * ??: TODO [ToDr] GP seems to mention a identity of a work-package:
     * https://graypaper.fluffylabs.dev/#/579bd12/199300199300
     */
    public readonly treeRoot: OpaqueHash,
    /** Index of the prior exported segment. */
    public readonly index: SegmentIndex,
  ) {
    super();
  }
}

/** Introduced blob hashes and their lengths. */
export class WorkItemExtrinsicSpec extends WithDebug {
  static Codec = codec.Class(WorkItemExtrinsicSpec, {
    hash: codec.bytes(HASH_SIZE).asOpaque(),
    len: codec.u32,
  });

  static fromCodec({ hash, len }: CodecRecord<WorkItemExtrinsicSpec>) {
    return new WorkItemExtrinsicSpec(hash, len);
  }

  constructor(
    /** The pre-image to this hash should be passed to the guarantor alongisde the work-package. */
    public readonly hash: WorkItemExtrinsicHash,
    /** Length of the preimage identified by the hash above. */
    public readonly len: U32,
  ) {
    super();
  }
}
/**
 * Extrinsics that are needed by [`WorkItem`]s and are specified via [`WorkItemExtrinsicSpec`].
 */
export type WorkItemExtrinsics = KnownSizeArray<
  Bytes<U32>,
  "Count of all extrinsics within work items in a work package"
>;
/**
 * To encode/decode extrinsics that are specified via [`WorkItemExtrinsicSpec`]
 * we need to know their lenghts. Hence this is created dynamically.
 *
 * TODO [ToDr] Consider passing a hash and exit early on hash mismatch?
 */
export function workItemExtrinsicsCodec(workItems: WorkItem[]) {
  const extrinsicLengths = Array<U32>();
  for (const item of workItems) {
    for (const extrinsic of item.extrinsic) {
      extrinsicLengths.push(extrinsic.len);
    }
  }
  const sum = sumU32(...extrinsicLengths);
  if (sum.overflow) {
    throw new Error("Unable to create a decoder, because the length of extrinsics overflows!");
  }

  return codec.custom<WorkItemExtrinsics>(
    {
      name: "WorkItemExtrinsics",
      sizeHint: { bytes: sum.value, isExact: true },
    },
    (e, val) => {
      for (const bytes of val) {
        e.bytes(bytes);
      }
    },
    (d) => {
      const extrinsics = Array<Bytes<U32>>();
      for (const len of extrinsicLengths) {
        const bytes = d.bytes(len);
        extrinsics.push(bytes);
      }
      return asOpaqueType(extrinsics);
    },
    (s) => s.decoder.skip(sum.value),
  );
}

/**
 * Work Item which is a part of some work package.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/198b00199600
 */
export class WorkItem extends WithDebug {
  static Codec = codec.Class(WorkItem, {
    service: codec.u32.asOpaque(),
    codeHash: codec.bytes(HASH_SIZE).asOpaque(),
    payload: codec.blob,
    refineGasLimit: codec.u64.asOpaque(),
    accumulateGasLimit: codec.u64.asOpaque(),
    // TODO [ToDr] Limit the number of items when decoding.
    importSegments: codec.sequenceVarLen(ImportSpec.Codec).asOpaque(),
    extrinsic: codec.sequenceVarLen(WorkItemExtrinsicSpec.Codec),
    // TODO [ToDr] Verify the size is lower than 2**11 when importing
    exportCount: codec.u16,
  });

  static fromCodec({
    service,
    codeHash,
    payload,
    refineGasLimit,
    accumulateGasLimit,
    importSegments,
    extrinsic,
    exportCount,
  }: CodecRecord<WorkItem>) {
    return new WorkItem(
      service,
      codeHash,
      payload,
      refineGasLimit,
      accumulateGasLimit,
      importSegments,
      extrinsic,
      exportCount,
    );
  }

  constructor(
    /** `s`: related service */
    public readonly service: ServiceId,
    /**
     * `c`: code hash of the service at the time of reporting.
     *
     * preimage of that hash must be available from the perspective of the lookup
     * anchor block.
     */
    public readonly codeHash: CodeHash,
    /** `y`: payload blob */
    public readonly payload: BytesBlob,
    /** `g`: refine execution gas limit */
    public readonly refineGasLimit: ServiceGas,
    /** `a`: accumulate execution gas limit */
    public readonly accumulateGasLimit: ServiceGas,
    /** `i`: sequence of imported data segments, which identify a prior exported segment. */
    public readonly importSegments: KnownSizeArray<ImportSpec, `Less than ${typeof MAX_NUMBER_OF_SEGMENTS}`>,
    /** `x`: sequence of blob hashes and lengths to be introduced in this block */
    public readonly extrinsic: WorkItemExtrinsicSpec[],
    /** `e`: number of data segments exported by this work item. */
    public readonly exportCount: U16,
  ) {
    super();
  }
}
