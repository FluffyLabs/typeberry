import type { KnownSizeArray } from "@typeberry/collections";
import { type FromJson, json } from "@typeberry/json-parser";
import { type Ed25519Signature, type Slot, type ValidatorIndex, fromJson, logger } from ".";
import { WorkReport } from "./work_report";

class ValidatorSignature {
  static fromJson: FromJson<ValidatorSignature> = {
    validator_index: "number",
    signature: fromJson.ed25519Signature,
  };

  validator_index!: ValidatorIndex;
  signature!: Ed25519Signature;

  private constructor() {}
}

class ReportGuarantee {
  static fromJson: FromJson<ReportGuarantee> = {
    report: WorkReport.fromJson,
    slot: "number",
    signatures: json.array(ValidatorSignature.fromJson),
  };
  report!: WorkReport;
  slot!: Slot;
  signatures!: KnownSizeArray<ValidatorSignature, "0..ValidatorsCount">;

  private constructor() {}
}

export type GuaranteesExtrinsic = KnownSizeArray<ReportGuarantee, "0..CoresCount">;
export const GuaranteesExtrinsicFromJson = json.array(ReportGuarantee.fromJson);

export async function runGuaranteesExtrinsicTest(test: GuaranteesExtrinsic, file: string) {
  logger.trace(JSON.stringify(test, null, 2));
  logger.error(`Not implemented yet! ${file}`);
}
