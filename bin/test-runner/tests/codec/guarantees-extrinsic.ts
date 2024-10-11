import {
  type GuaranteesExtrinsic,
  ReportGuarantee,
  ValidatorSignature,
  guaranteesExtrinsicCodec,
} from "@typeberry/block/gaurantees";
import { json } from "@typeberry/json-parser";
import { fromJson, runCodecTest } from ".";
import type { JsonObject } from "../../json-format";
import { workReportFromJson } from "./work-report";

const validatorSignatureFromJson = json.object<JsonObject<ValidatorSignature>, ValidatorSignature>(
  {
    validator_index: "number",
    signature: fromJson.ed25519Signature,
  },
  ({ validator_index, signature }) => new ValidatorSignature(validator_index, signature),
);

const reportGuaranteeFromJson = json.object<ReportGuarantee>(
  {
    report: workReportFromJson,
    slot: "number",
    signatures: json.array(validatorSignatureFromJson),
  },
  ({ report, slot, signatures }) => new ReportGuarantee(report, slot, signatures),
);

export const guaranteesExtrinsicFromJson = json.array(reportGuaranteeFromJson);

export async function runGuaranteesExtrinsicTest(test: GuaranteesExtrinsic, file: string) {
  runCodecTest(guaranteesExtrinsicCodec, test, file);
}
