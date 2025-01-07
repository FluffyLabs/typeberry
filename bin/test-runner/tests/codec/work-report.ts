import type { CoreIndex } from "@typeberry/block";
import type { RefineContext } from "@typeberry/block/refine-context";
import { MAX_NUMBER_OF_WORK_ITEMS } from "@typeberry/block/work-package";
import { AuthorizerHash, SegmentRootLookupItem, WorkPackageSpec, WorkReport } from "@typeberry/block/work-report";
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
    length: "number",
    erasure_root: fromJson.bytes32(),
    exports_root: fromJson.bytes32(),
    exports_count: "number",
  },
  ({ hash, length, erasure_root, exports_root, exports_count }) =>
    new WorkPackageSpec(hash, length, erasure_root, exports_root, exports_count),
);

const segmentRootLookupItemFromJson = json.object<JsonObject<SegmentRootLookupItem>, SegmentRootLookupItem>(
  {
    work_package_hash: fromJson.bytes32(),
    segment_tree_root: fromJson.bytes32(),
  },
  ({ work_package_hash, segment_tree_root }) => new SegmentRootLookupItem(work_package_hash, segment_tree_root),
);

export const workReportFromJson = json.object<JsonWorkReport, WorkReport>(
  {
    package_spec: workPackageSpecFromJson,
    context: refineContextFromJson,
    core_index: "number",
    authorizer_hash: fromJson.bytes32(),
    auth_output: json.fromString(BytesBlob.parseBlob),
    segment_root_lookup: json.array(segmentRootLookupItemFromJson),
    results: json.array(workResultFromJson),
  },
  ({ package_spec, context, core_index, authorizer_hash, auth_output, results, segment_root_lookup }) =>
    new WorkReport(
      package_spec,
      context,
      core_index,
      authorizer_hash,
      auth_output,
      segment_root_lookup,
      // TODO [ToDr] Verify the length and throw an exception.
      new FixedSizeArray(results, Math.min(results.length, MAX_NUMBER_OF_WORK_ITEMS)),
    ),
);

type JsonWorkReport = {
  package_spec: WorkPackageSpec;
  context: RefineContext;
  core_index: CoreIndex;
  authorizer_hash: AuthorizerHash;
  auth_output: BytesBlob;
  segment_root_lookup: SegmentRootLookupItem[];
  results: WorkResult[];
};

export async function runWorkReportTest(test: WorkReport, file: string) {
  runCodecTest(WorkReport.Codec, test, file);
}
