import { type FromJson, json } from "@typeberry/json-parser";
import { type Ed25519Signature, type Slot, type ValidatorIndex, fromJson, logger } from ".";
import { WorkReport } from "./work_report";

class ValidatorSignature {
  static fromJson: FromJson<ValidatorSignature> = {
    validator_index: json.castNumber(),
    signature: fromJson.ed25519Signature,
  };

  validator_index!: ValidatorIndex;
  signature!: Ed25519Signature;

  private constructor() {}
}

class ReportGuarantee {
  static fromJson: FromJson<ReportGuarantee> = {
    report: WorkReport.fromJson,
    slot: json.castNumber(),
    signatures: json.array(ValidatorSignature.fromJson),
  };
  report!: WorkReport;
  slot!: Slot;
  signatures!: ValidatorSignature[];

  private constructor() {}
}

export type GuaranteesExtrinsic = ReportGuarantee[];
export const GuaranteesExtrinsicFromJson = json.array(ReportGuarantee.fromJson);

export async function runGuaranteesExtrinsicTest(test: GuaranteesExtrinsic, file: string) {
  logger.trace(JSON.stringify(test, null, 2));
  logger.error(`Not implemented yet! ${file}`);
}
