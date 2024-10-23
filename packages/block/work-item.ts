import type { BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, codec } from "@typeberry/codec";
import type { KnownSizeArray } from "@typeberry/collections";
import { HASH_SIZE, type OpaqueHash } from "@typeberry/hash";
import type { U16, U32 } from "@typeberry/numbers";
import { type Opaque, WithDebug } from "@typeberry/utils";
import type { ServiceGas, ServiceId } from "./common";
import type { CodeHash } from "./hash";

type WorkItemExtrinsicHash = Opaque<OpaqueHash, "ExtrinsicHash">;

/**
 * Definition of data segment that was exported by some work package earlier
 * and now is being imported by another work-item.
 */
export class ImportSpec extends WithDebug {
  static Codec = codec.Class(ImportSpec, {
    treeRoot: codec.bytes(HASH_SIZE),
    index: codec.u16,
  });

  static fromCodec({ treeRoot, index }: CodecRecord<ImportSpec>) {
    return new ImportSpec(treeRoot, index);
  }

  constructor(
    /**
     * ??: TODO [ToDr] GP seems to mention a identity of a work-package:
     * https://graypaper.fluffylabs.dev/#/c71229b/195500195500
     */
    public readonly treeRoot: OpaqueHash,
    /** Index of the prior exported segment. */
    public readonly index: U16,
  ) {
    super();
  }
}

/** Introduced blob hashes and their lengths. */
export class WorkItemExtrinsicSpec extends WithDebug {
  static Codec = codec.Class(WorkItemExtrinsicSpec, {
    hash: codec.bytes(HASH_SIZE).cast(),
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
 * Work Item which is a part of some work package.
 *
 * https://graypaper.fluffylabs.dev/#/c71229b/194e00195800
 */
export class WorkItem extends WithDebug {
  static Codec = codec.Class(WorkItem, {
    service: codec.u32.cast(),
    codeHash: codec.bytes(HASH_SIZE).cast(),
    payload: codec.blob,
    gasLimit: codec.u64.cast(),
    // TODO [ToDr] Limit the number of items when decoding.
    importSegments: codec.sequenceVarLen(ImportSpec.Codec).cast(),
    extrinsic: codec.sequenceVarLen(WorkItemExtrinsicSpec.Codec),
    // TODO [ToDr] Verify the size is lower than 2**11 when importing
    exportCount: codec.u16,
  });

  static fromCodec({
    service,
    codeHash,
    payload,
    gasLimit,
    importSegments,
    extrinsic,
    exportCount,
  }: CodecRecord<WorkItem>) {
    return new WorkItem(service, codeHash, payload, gasLimit, importSegments, extrinsic, exportCount);
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
    /** `g`: execution gas limit */
    public readonly gasLimit: ServiceGas,
    /** `i`: sequence of imported data segments, which identify a prior exported segment. */
    public readonly importSegments: KnownSizeArray<ImportSpec, "Less than 2**11">,
    /** `x`: sequence of blob hashes and lengths to be introduced in this block */
    public readonly extrinsic: WorkItemExtrinsicSpec[],
    /** `e`: number of data segments exported by this work item. */
    public readonly exportCount: U16,
  ) {
    super();
  }
}
