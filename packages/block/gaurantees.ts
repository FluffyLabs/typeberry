import { type CodecRecord, codec } from "@typeberry/codec";
import type { KnownSizeArray } from "@typeberry/collections";
import type { TimeSlot, ValidatorIndex } from "./common";
import { ED25519_SIGNATURE_BYTES, type Ed25519Signature } from "./crypto";
import { WorkReport } from "./work_report";

export class ValidatorSignature {
  static Codec = codec.Class(ValidatorSignature, {
    validatorIndex: codec.u16.cast(),
    signature: codec.bytes(ED25519_SIGNATURE_BYTES).cast(),
  });

  static fromCodec({ validatorIndex, signature }: CodecRecord<ValidatorSignature>) {
    return new ValidatorSignature(validatorIndex, signature);
  }

  constructor(
    public readonly validatorIndex: ValidatorIndex,
    public readonly signature: Ed25519Signature,
  ) {}
}

export class ReportGuarantee {
  static Codec = codec.Class(ReportGuarantee, {
    report: WorkReport.Codec,
    slot: codec.u32.cast(),
    signatures: codec.sequenceVarLen(ValidatorSignature.Codec).cast(),
  });

  static fromCodec({ report, slot, signatures }: CodecRecord<ReportGuarantee>) {
    return new ReportGuarantee(report, slot, signatures);
  }

  constructor(
    public readonly report: WorkReport,
    public readonly slot: TimeSlot,
    public readonly signatures: KnownSizeArray<ValidatorSignature, "0..ValidatorsCount">,
  ) {}
}

export type GuaranteesExtrinsic = KnownSizeArray<ReportGuarantee, "0..CoresCount">;
export const guaranteesExtrinsicCodec = codec.sequenceVarLen(ReportGuarantee.Codec).cast<GuaranteesExtrinsic>();
