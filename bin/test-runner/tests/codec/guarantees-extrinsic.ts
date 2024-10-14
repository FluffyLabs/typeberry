import type { TimeSlot } from "@typeberry/block";
import {
  Credential,
  type GuaranteesExtrinsic,
  ReportGuarantee,
  guaranteesExtrinsicCodec,
} from "@typeberry/block/gaurantees";
import type { WorkReport } from "@typeberry/block/work-report";
import type { KnownSizeArray } from "@typeberry/collections";
import { json } from "@typeberry/json-parser";
import type { JsonObject } from "../../json-format";
import { fromJson, runCodecTest } from "./common";
import { workReportFromJson } from "./work-report";

const validatorSignatureFromJson = json.object<JsonObject<Credential>, Credential>(
  {
    validator_index: "number",
    signature: fromJson.ed25519Signature,
  },
  ({ validator_index, signature }) => new Credential(validator_index, signature),
);

const reportGuaranteeFromJson = json.object<JsonReportGuarantee, ReportGuarantee>(
  {
    report: workReportFromJson,
    slot: "number",
    signatures: json.array(validatorSignatureFromJson),
  },
  ({ report, slot, signatures }) => new ReportGuarantee(report, slot, signatures),
);

type JsonReportGuarantee = {
  report: WorkReport;
  slot: TimeSlot;
  signatures: KnownSizeArray<Credential, "0..ValidatorsCount">;
};

export const guaranteesExtrinsicFromJson = json.array(reportGuaranteeFromJson);

export async function runGuaranteesExtrinsicTest(test: GuaranteesExtrinsic, file: string) {
  runCodecTest(guaranteesExtrinsicCodec, test, file);
}
