import type { TimeSlot } from "@typeberry/block";
import { Credential, ReportGuarantee } from "@typeberry/block/guarantees.js";
import type { WorkReport } from "@typeberry/block/work-report.js";
import { json } from "@typeberry/json-parser";
import { fromJson } from "./common.js";
import type { JsonObject } from "./json-format.js";
import { workReportFromJson } from "./work-report.js";

const validatorSignatureFromJson = json.object<JsonObject<Credential>, Credential>(
  {
    validator_index: "number",
    signature: fromJson.ed25519Signature,
  },
  ({ validator_index, signature }) => Credential.create({ validatorIndex: validator_index, signature }),
);

const reportGuaranteeFromJson = json.object<JsonReportGuarantee, ReportGuarantee>(
  {
    report: workReportFromJson,
    slot: "number",
    signatures: json.array(validatorSignatureFromJson),
  },
  ({ report, slot, signatures }) => ReportGuarantee.create({ report, slot, credentials: signatures }),
);

type JsonReportGuarantee = {
  report: WorkReport;
  slot: TimeSlot;
  signatures: ReportGuarantee["credentials"];
};

export const guaranteesExtrinsicFromJson = json.array(reportGuaranteeFromJson);
