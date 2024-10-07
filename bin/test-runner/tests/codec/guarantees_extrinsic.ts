import type { KnownSizeArray } from "@typeberry/collections";
import { json } from "@typeberry/json-parser";
import { type Ed25519Signature, fromJson, logger } from ".";
import { WorkReport } from "./work_report";
import {TimeSlot, ValidatorIndex} from "@typeberry/block";

class ValidatorSignature {
  static fromJson = json.object<ValidatorSignature>(
    {
      validator_index: "number",
      signature: fromJson.ed25519Signature,
    },
    (v) => Object.assign(new ValidatorSignature(), v),
  );

  validator_index!: ValidatorIndex;
  signature!: Ed25519Signature;

  private constructor() {}
}

class ReportGuarantee {
  static fromJson = json.object<ReportGuarantee>(
    {
      report: WorkReport.fromJson,
      slot: "number",
      signatures: json.array(ValidatorSignature.fromJson),
    },
    (x) => Object.assign(new ReportGuarantee(), x),
  );

  report!: WorkReport;
  slot!: TimeSlot;
  signatures!: KnownSizeArray<ValidatorSignature, "0..ValidatorsCount">;

  private constructor() {}
}

export type GuaranteesExtrinsic = KnownSizeArray<ReportGuarantee, "0..CoresCount">;
export const GuaranteesExtrinsicFromJson = json.array(ReportGuarantee.fromJson);

export async function runGuaranteesExtrinsicTest(test: GuaranteesExtrinsic, file: string) {
  logger.trace(JSON.stringify(test, null, 2));
  logger.error(`Not implemented yet! ${file}`);
}
