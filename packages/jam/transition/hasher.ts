import {
  Extrinsic,
  type ExtrinsicHash,
  type ExtrinsicView,
  type HeaderHash,
  type HeaderView,
  type TimeSlot,
  type WorkReportHash,
} from "@typeberry/block";
import { WorkPackage } from "@typeberry/block/work-package";
import type { WorkPackageHash } from "@typeberry/block/work-report";
import type { BytesBlob } from "@typeberry/bytes";
import { type Codec, Encoder, codec } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import {
  HASH_SIZE,
  type HashAllocator,
  type KeccakHash,
  type OpaqueHash,
  WithHash,
  WithHashAndBytes,
  blake2b,
  keccak,
} from "@typeberry/hash";
import type { MmrHasher } from "@typeberry/mmr";

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

  extrinsic(extrinsic: Extrinsic): WithHashAndBytes<ExtrinsicHash, Extrinsic> {
    // TODO [ToDr] This is incorrect, since extrinc hash should be a merkle root.
    return this.encode(Extrinsic.Codec, extrinsic);
  }

  /**
   * Merkle commitment of the extrinsic data
   *
   * https://graypaper.fluffylabs.dev/#/cc517d7/0ca1000ca200?v=0.6.5
   */
  extrinsicHash(extrinsicView: ExtrinsicView): WithHashAndBytes<ExtrinsicHash, ExtrinsicView> {
    const guaranteeCodec = codec.object({
      workReportHash: codec.bytes(HASH_SIZE).asOpaque<WorkReportHash>(),
      timeSlot: codec.u32.asOpaque<TimeSlot>(),
      credentials: codec.blob,
    });

    const guarantees: BytesBlob[] = [];

    // https://graypaper.fluffylabs.dev/#/cc517d7/0cfb000cfb00?v=0.6.5
    for (const guaranteeView of extrinsicView.guarantees.view()) {
      const guarantee = guaranteeView.view();
      const reportHash = blake2b.hashBytes(guarantee.report.encoded()).asOpaque<WorkReportHash>();
      const guaranteeEncoded = Encoder.encodeObject(guaranteeCodec, {
        workReportHash: reportHash,
        timeSlot: guarantee.slot.materialize(),
        credentials: guarantee.credentials.encoded(),
      });
      guarantees.push(guaranteeEncoded);
    }

    const guaranteeBlob = Encoder.encodeObject(codec.sequenceVarLen(codec.blob), guarantees, this.context);

    const et = blake2b.hashBytes(extrinsicView.tickets.encoded()).asOpaque<ExtrinsicHash>();
    const ep = blake2b.hashBytes(extrinsicView.preimages.encoded()).asOpaque<ExtrinsicHash>();
    const eg = blake2b.hashBytes(guaranteeBlob).asOpaque<ExtrinsicHash>();
    const ea = blake2b.hashBytes(extrinsicView.assurances.encoded()).asOpaque<ExtrinsicHash>();
    const ed = blake2b.hashBytes(extrinsicView.disputes.encoded()).asOpaque<ExtrinsicHash>();

    const encoded = Encoder.encodeObject(
      codec.object({
        tickets: codec.bytes(HASH_SIZE).asOpaque<ExtrinsicHash>(),
        preimages: codec.bytes(HASH_SIZE).asOpaque<ExtrinsicHash>(),
        guarantees: codec.bytes(HASH_SIZE).asOpaque<ExtrinsicHash>(),
        assurances: codec.bytes(HASH_SIZE).asOpaque<ExtrinsicHash>(),
        disputes: codec.bytes(HASH_SIZE).asOpaque<ExtrinsicHash>(),
      }),
      {
        tickets: et,
        preimages: ep,
        guarantees: eg,
        assurances: ea,
        disputes: ed,
      },
      this.context,
    );

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
