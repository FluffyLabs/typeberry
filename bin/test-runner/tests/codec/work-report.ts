import { WorkPackageSpec, WorkReport } from "@typeberry/block/work-report";
import { BytesBlob } from "@typeberry/bytes";
import { json } from "@typeberry/json-parser";
import { fromJson, runCodecTest } from ".";
import type { JsonObject } from "../../json-format";
import { refineContextFromJson } from "./refine-context";
import { workResultFromJson } from "./work-result";

const workPackageSpecFromJson = json.object<JsonObject<WorkPackageSpec>, WorkPackageSpec>(
  {
    hash: fromJson.bytes32(),
    len: "number",
    erasure_root: fromJson.bytes32(),
    exports_root: fromJson.bytes32(),
  },
  ({ hash, len, erasure_root, exports_root }) => new WorkPackageSpec(hash, len, erasure_root, exports_root),
);

export const workReportFromJson = json.object<JsonObject<WorkReport>, WorkReport>(
  {
    package_spec: workPackageSpecFromJson,
    context: refineContextFromJson,
    core_index: "number",
    authorizer_hash: fromJson.bytes32(),
    auth_output: json.fromString(BytesBlob.parseBlob),
    results: json.array(workResultFromJson),
  },
  ({ package_spec, context, core_index, authorizer_hash, auth_output, results }) =>
    new WorkReport(package_spec, context, core_index, authorizer_hash, auth_output, results),
);

export async function runWorkReportTest(test: WorkReport, file: string) {
  runCodecTest(WorkReport.Codec, test, file);
}
