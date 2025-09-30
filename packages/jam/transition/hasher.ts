import type { ExtrinsicHash, ExtrinsicView, HeaderHash, HeaderView, WorkReportHash } from "@typeberry/block";
import type { WorkPackageHash } from "@typeberry/block/refine-context.js";
import { WorkPackage } from "@typeberry/block/work-package.js";
import { BytesBlob } from "@typeberry/bytes";
import { type Codec, codec, Encoder } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import {
  type KeccakHash,
  keccak,
  type OpaqueHash,
  WithHash,
  WithHashAndBytes,
  Blake2b,
} from "@typeberry/hash";
import type { MmrHasher } from "@typeberry/mmr";
import { dumpCodec } from "@typeberry/state-merkleization/serialize.js";

/** Helper function to create most used hashes in the block */
export class TransitionHasher implements MmrHasher<KeccakHash> {
  constructor(
    private readonly context: ChainSpec,
    private readonly keccakHasher: keccak.KeccakHasher,
    public readonly blake2b: Blake2b,
  ) {}

  /** Concatenates two hashes and hash this concatenation */
  hashConcat(a: KeccakHash, b: KeccakHash): KeccakHash {
    return keccak.hashBlobs(this.keccakHasher, [a, b]);
  }

  hashConcatPrepend(id: BytesBlob, a: KeccakHash, b: KeccakHash): KeccakHash {
    return keccak.hashBlobs(this.keccakHasher, [id, a, b]);
  }

  /** Creates hash from the block header view */
  header(header: HeaderView): WithHash<HeaderHash, HeaderView> {
    return new WithHash(this.blake2b.hashBytes(header.encoded()).asOpaque(), header);
  }

  /**
   * Merkle commitment of the extrinsic data
   *
   * https://graypaper.fluffylabs.dev/#/cc517d7/0ca1000ca200?v=0.6.5
   */
  extrinsic(extrinsicView: ExtrinsicView): WithHashAndBytes<ExtrinsicHash, ExtrinsicView> {
    // https://graypaper.fluffylabs.dev/#/cc517d7/0cfb000cfb00?v=0.6.5
    const guarantees = extrinsicView.guarantees
      .view()
      .map((g) => g.view())
      .map((guarantee) => {
        const reportHash = this.blake2b.hashBytes(guarantee.report.encoded()).asOpaque<WorkReportHash>();
        return BytesBlob.blobFromParts([
          reportHash.raw,
          guarantee.slot.encoded().raw,
          guarantee.credentials.encoded().raw,
        ]);
      });

    const guaranteeBlob = Encoder.encodeObject(codec.sequenceVarLen(dumpCodec), guarantees, this.context);

    const et = this.blake2b.hashBytes(extrinsicView.tickets.encoded()).asOpaque<ExtrinsicHash>();
    const ep = this.blake2b.hashBytes(extrinsicView.preimages.encoded()).asOpaque<ExtrinsicHash>();
    const eg = this.blake2b.hashBytes(guaranteeBlob).asOpaque<ExtrinsicHash>();
    const ea = this.blake2b.hashBytes(extrinsicView.assurances.encoded()).asOpaque<ExtrinsicHash>();
    const ed = this.blake2b.hashBytes(extrinsicView.disputes.encoded()).asOpaque<ExtrinsicHash>();

    const encoded = BytesBlob.blobFromParts([et.raw, ep.raw, eg.raw, ea.raw, ed.raw]);

    return new WithHashAndBytes(this.blake2b.hashBytes(encoded).asOpaque(), extrinsicView, encoded);
  }

  /** Creates hash for given WorkPackage */
  workPackage(workPackage: WorkPackage): WithHashAndBytes<WorkPackageHash, WorkPackage> {
    return this.encode(WorkPackage.Codec, workPackage);
  }

  private encode<T, THash extends OpaqueHash>(codec: Codec<T>, data: T): WithHashAndBytes<THash, T> {
    // TODO [ToDr] Use already allocated encoding destination and hash bytes from some arena.
    const encoded = Encoder.encodeObject(codec, data, this.context);
    return new WithHashAndBytes(this.blake2b.hashBytes(encoded).asOpaque(), data, encoded);
  }
}
