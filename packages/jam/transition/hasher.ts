import type { ExtrinsicHash, ExtrinsicView, HeaderHash, HeaderView, WorkReportHash } from "@typeberry/block";
import { BytesBlob } from "@typeberry/bytes";
import { codec, Encoder } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import { type Blake2b, type KeccakHash, keccak, WithHash, WithHashAndBytes } from "@typeberry/hash";
import type { MmrHasher } from "@typeberry/mmr";
import { tryAsU32 } from "@typeberry/numbers";

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
    const guaranteesCount = tryAsU32(extrinsicView.guarantees.view().length);
    const countEncoded = Encoder.encodeObject(codec.varU32, guaranteesCount);
    const guaranteesBlobs = extrinsicView.guarantees
      .view()
      .map((g) => g.view())
      .reduce(
        (aggregated, guarantee) => {
          const reportHash = this.blake2b.hashBytes(guarantee.report.encoded()).asOpaque<WorkReportHash>();
          aggregated.push(reportHash.raw);
          aggregated.push(guarantee.slot.encoded().raw);
          aggregated.push(guarantee.credentials.encoded().raw);
          return aggregated;
        },
        [countEncoded.raw],
      );

    const et = this.blake2b.hashBytes(extrinsicView.tickets.encoded()).asOpaque<ExtrinsicHash>();
    const ep = this.blake2b.hashBytes(extrinsicView.preimages.encoded()).asOpaque<ExtrinsicHash>();
    const eg = this.blake2b.hashBlobs(guaranteesBlobs).asOpaque<ExtrinsicHash>();
    const ea = this.blake2b.hashBytes(extrinsicView.assurances.encoded()).asOpaque<ExtrinsicHash>();
    const ed = this.blake2b.hashBytes(extrinsicView.disputes.encoded()).asOpaque<ExtrinsicHash>();

    const encoded = BytesBlob.blobFromParts([et.raw, ep.raw, eg.raw, ea.raw, ed.raw]);

    return new WithHashAndBytes(this.blake2b.hashBytes(encoded).asOpaque(), extrinsicView, encoded);
  }
}
