import type { TimeSlot } from "@typeberry/block";
import {
  Credential,
  type GuaranteesExtrinsic,
  ReportGuarantee,
  guaranteesExtrinsicCodec,
} from "@typeberry/block/guarantees";
import type { WorkReport } from "@typeberry/block/work-report";
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
  // TODO [MaSo] Update to GP 0.6.4
  // Error: Sequence<Credential>[?]: length is below minimal. 0 < 2
  // eg. jamtestvectors/codec/data/extrinsic.json, jamtestvectors/codec/data/guarantees_extrinsic.json
  signatures: ReportGuarantee["credentials"];
};

export const guaranteesExtrinsicFromJson = json.array(reportGuaranteeFromJson);

export async function runGuaranteesExtrinsicTest(test: GuaranteesExtrinsic, file: string) {
  runCodecTest(guaranteesExtrinsicCodec, test, file);
}
