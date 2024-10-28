import type { RefineContext } from "@typeberry/block/refine-context";
import { MAX_NUMBER_OF_WORK_ITEMS } from "@typeberry/block/work-package";
import { type CoreIndex, WorkPackageSpec, WorkReport } from "@typeberry/block/work-report";
import type { WorkResult } from "@typeberry/block/work-result";
import { BytesBlob } from "@typeberry/bytes";
import { FixedSizeArray } from "@typeberry/collections";
import type { OpaqueHash } from "@typeberry/hash";
import { json } from "@typeberry/json-parser";
import type { JsonObject } from "../../json-format";
import { fromJson, runCodecTest } from "./common";
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

export const workReportFromJson = json.object<JsonWorkReport, WorkReport>(
  {
    package_spec: workPackageSpecFromJson,
    context: refineContextFromJson,
    core_index: "number",
    authorizer_hash: fromJson.bytes32(),
    auth_output: json.fromString(BytesBlob.parseBlob),
    results: json.array(workResultFromJson),
  },
  ({ package_spec, context, core_index, authorizer_hash, auth_output, results }) =>
    new WorkReport(
      package_spec,
      context,
      core_index,
      authorizer_hash,
      auth_output,
      // TODO [ToDr] Verify the length and throw an exception.
      new FixedSizeArray(results, Math.min(results.length, MAX_NUMBER_OF_WORK_ITEMS)),
    ),
);

type JsonWorkReport = {
  package_spec: WorkPackageSpec;
  context: RefineContext;
  core_index: CoreIndex;
  authorizer_hash: OpaqueHash;
  auth_output: BytesBlob;
  results: WorkResult[];
};

export async function runWorkReportTest(test: WorkReport, file: string) {
  runCodecTest(WorkReport.Codec, test, file);
}
