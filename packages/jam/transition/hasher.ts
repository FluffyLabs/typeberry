import type { ExtrinsicHash, ExtrinsicView, HeaderHash, HeaderView, WorkReportHash } from "@typeberry/block";
import { WorkPackage } from "@typeberry/block/work-package.js";
import type { WorkPackageHash } from "@typeberry/block/work-report.js";
import { BytesBlob } from "@typeberry/bytes";
import { type Codec, Encoder, codec } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import {
  type HashAllocator,
  type KeccakHash,
  type OpaqueHash,
  WithHash,
  WithHashAndBytes,
  blake2b,
  keccak,
} from "@typeberry/hash";
import type { MmrHasher } from "@typeberry/mmr";
import { dumpCodec } from "@typeberry/state-merkleization/serialize.js";

export class TransitionHasher implements MmrHasher<KeccakHash> {
  constructor(
    private readonly context: ChainSpec,
    private readonly keccakHasher: keccak.KeccakHasher,
    private readonly allocator: HashAllocator,
  ) {}

  hashConcat(a: KeccakHash, b: KeccakHash): KeccakHash {
    return keccak.hashBlobs(this.keccakHasher, [a, b]);
  }
  hashConcatPrepend(id: BytesBlob, a: KeccakHash, b: KeccakHash): KeccakHash {
    return keccak.hashBlobs(this.keccakHasher, [id, a, b]);
  }

  header(header: HeaderView): WithHash<HeaderHash, HeaderView> {
    return new WithHash(blake2b.hashBytes(header.encoded(), this.allocator).asOpaque(), header);
  }

  /**
   * Merkle commitment of the extrinsic data
   *
   * https://graypaper.fluffylabs.dev/#/cc517d7/0ca1000ca200?v=0.6.5
   */
  extrinsic(extrinsicView: ExtrinsicView): WithHashAndBytes<ExtrinsicHash, ExtrinsicView> {
    // const guarantees: {report: WorkReportHash, slot: ReportGuarantee['slot'], credentials: ReportGuarantee['credentials']}[] = [];

    // https://graypaper.fluffylabs.dev/#/cc517d7/0cfb000cfb00?v=0.6.5
    const guarantees = extrinsicView.guarantees
      .view()
      .map((g) => g.view())
      .map((guarantee) => {
        const reportHash = blake2b.hashBytes(guarantee.report.encoded(), this.allocator).asOpaque<WorkReportHash>();
        return BytesBlob.blobFromParts([
          reportHash.raw,
          guarantee.slot.encoded().raw,
          guarantee.credentials.encoded().raw,
        ]);
      });

    const guaranteeBlob = Encoder.encodeObject(codec.sequenceVarLen(dumpCodec), guarantees, this.context);

    const et = blake2b.hashBytes(extrinsicView.tickets.encoded(), this.allocator).asOpaque<ExtrinsicHash>();
    const ep = blake2b.hashBytes(extrinsicView.preimages.encoded(), this.allocator).asOpaque<ExtrinsicHash>();
    const eg = blake2b.hashBytes(guaranteeBlob, this.allocator).asOpaque<ExtrinsicHash>();
    const ea = blake2b.hashBytes(extrinsicView.assurances.encoded(), this.allocator).asOpaque<ExtrinsicHash>();
    const ed = blake2b.hashBytes(extrinsicView.disputes.encoded(), this.allocator).asOpaque<ExtrinsicHash>();

    const encoded = BytesBlob.blobFromParts([et.raw, ep.raw, eg.raw, ea.raw, ed.raw]);

    return new WithHashAndBytes(blake2b.hashBytes(encoded, this.allocator).asOpaque(), extrinsicView, encoded);
  }

  workPackage(workPackage: WorkPackage): WithHashAndBytes<WorkPackageHash, WorkPackage> {
    return this.encode(WorkPackage.Codec, workPackage);
  }

  private encode<T, THash extends OpaqueHash>(codec: Codec<T>, data: T): WithHashAndBytes<THash, T> {
    // TODO [ToDr] Use already allocated encoding destination and hash bytes from some arena.
    const encoded = Encoder.encodeObject(codec, data, this.context);
    return new WithHashAndBytes(blake2b.hashBytes(encoded, this.allocator).asOpaque(), data, encoded);
  }
}
