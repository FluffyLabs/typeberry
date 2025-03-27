import { type CodecRecord, type DescribedBy, codec } from "@typeberry/codec";
import type { KnownSizeArray } from "@typeberry/collections";
import { WithDebug } from "@typeberry/utils";
import { codecKnownSizeArray, codecWithContext } from "./codec";
import type { TimeSlot, ValidatorIndex } from "./common";
import { ED25519_SIGNATURE_BYTES, type Ed25519Signature } from "./crypto";
import { WorkReport } from "./work-report";

/**
 * Required number of credentials for each work report.
 * The maximal value is `NoOfValidators / NoOfCores`
 * (i.e. signatures from ALL validators assigned to the core)
 * however 2/3rds is sufficent.
 * Since GP defines that value explicitly as "two or three",
 * we do that as well.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/14b90214bb02
 */
export type REQUIRED_CREDENTIALS = 2 | 3;
export const REQUIRED_CREDENTIALS_RANGE = [2, 3];

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
    credentials: codecKnownSizeArray(Credential.Codec, {
      minLength: REQUIRED_CREDENTIALS_RANGE[0],
      maxLength: REQUIRED_CREDENTIALS_RANGE[1],
      typicalLength: REQUIRED_CREDENTIALS_RANGE[1],
    }),
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
    public readonly credentials: KnownSizeArray<Credential, `${REQUIRED_CREDENTIALS}`>,
  ) {
    super();
  }
}

export const GuaranteesExtrinsicBounds = "[0..CoresCount)";
/**
 * `E_G`: Series of guarantees, at most one for each core.
 *
 * Each core index (within work-report) must be unique and guarantees
 * must be in ascending order of this.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/146402146702
 */
export type GuaranteesExtrinsic = KnownSizeArray<ReportGuarantee, typeof GuaranteesExtrinsicBounds>;

export const guaranteesExtrinsicCodec = codecWithContext((context) =>
  codecKnownSizeArray(
    ReportGuarantee.Codec,
    {
      minLength: 0,
      maxLength: context.coresCount,
      typicalLength: context.coresCount,
    },
    GuaranteesExtrinsicBounds,
  ),
);

export type GuaranteesExtrinsicView = DescribedBy<typeof guaranteesExtrinsicCodec.View>;
