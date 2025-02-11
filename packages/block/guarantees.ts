import { type CodecRecord, type DescribedBy, codec } from "@typeberry/codec";
import type { KnownSizeArray } from "@typeberry/collections";
import { WithDebug, asOpaqueType } from "@typeberry/utils";
import type { TimeSlot, ValidatorIndex } from "./common";
import { ED25519_SIGNATURE_BYTES, type Ed25519Signature } from "./crypto";
import { WorkReport } from "./work-report";

/** Unique validator index & signature. */
export class Credential extends WithDebug {
  static Codec = codec.Class(Credential, {
    validatorIndex: codec.u16.asOpaque(),
    signature: codec.bytes(ED25519_SIGNATURE_BYTES).asOpaque(),
  });

  static fromCodec({ validatorIndex, signature }: CodecRecord<Credential>) {
    return new Credential(validatorIndex, signature);
  }

  constructor(
    /** Validator index signing the guarantee. */
    public readonly validatorIndex: ValidatorIndex,
    /** Signature over hash of the work-report. */
    public readonly signature: Ed25519Signature,
  ) {
    super();
  }
}

/**
 * Tuple of work-report, a credential and it's corresponding timeslot.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/147102149102
 */
export class ReportGuarantee extends WithDebug {
  static Codec = codec.Class(ReportGuarantee, {
    report: WorkReport.Codec,
    slot: codec.u32.asOpaque(),
    // TODO [ToDr] constrain the sequence length during decoding.
    credentials: codec.sequenceVarLen(Credential.Codec).asOpaque(),
  });

  static fromCodec({ report, slot, credentials }: CodecRecord<ReportGuarantee>) {
    return new ReportGuarantee(report, slot, credentials);
  }

  constructor(
    /** The work-report being guaranteed. */
    public readonly report: WorkReport,
    /** Timeslot of the report. */
    public readonly slot: TimeSlot,
    /**
     * The credential is a sequence of two or three tuples of a unique
     * validator index and a signature.
     * Credentials must be ordered by their validator index.
     *
     * https://graypaper.fluffylabs.dev/#/579bd12/14b90214bb02
     */
    public readonly credentials: KnownSizeArray<Credential, "0..ValidatorsCount/CoresCount">,
  ) {
    super();
  }
}

/**
 * `E_G`: Series of guarantees, at most one for each core.
 *
 * Each core index (within work-report) must be unique and guarantees
 * must be in ascending order of this.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/146402146702
 */
export type GuaranteesExtrinsic = KnownSizeArray<ReportGuarantee, "0..CoresCount">;

// TODO [ToDr] constrain the sequence length during decoding.
export const guaranteesExtrinsicCodec = codec
  .sequenceVarLen(ReportGuarantee.Codec)
  .convert<GuaranteesExtrinsic>((i) => i, asOpaqueType);

export type GuaranteesExtrinsicView = DescribedBy<typeof guaranteesExtrinsicCodec.View>;
