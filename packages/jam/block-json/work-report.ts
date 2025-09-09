import { type CoreIndex, type ServiceGas, tryAsServiceGas } from "@typeberry/block";
import { type AuthorizerHash, type RefineContext, WorkPackageInfo } from "@typeberry/block/refine-context.js";
import { tryAsWorkItemsCount } from "@typeberry/block/work-package.js";
import { WorkPackageSpec, WorkReport } from "@typeberry/block/work-report.js";
import type { WorkResult } from "@typeberry/block/work-result.js";
import { BytesBlob } from "@typeberry/bytes";
import { FixedSizeArray } from "@typeberry/collections";
import { json } from "@typeberry/json-parser";
import { fromJson } from "./common.js";
import type { JsonObject } from "./json-format.js";
import { refineContextFromJson } from "./refine-context.js";
import { workResultFromJson } from "./work-result.js";

const workPackageSpecFromJson = json.object<JsonObject<WorkPackageSpec>, WorkPackageSpec>(
  {
    hash: fromJson.bytes32(),
    length: "number",
    erasure_root: fromJson.bytes32(),
    exports_root: fromJson.bytes32(),
    exports_count: "number",
  },
  ({ hash, length, erasure_root, exports_root, exports_count }) =>
    WorkPackageSpec.create({
      hash,
      length,
      erasureRoot: erasure_root,
      exportsRoot: exports_root,
      exportsCount: exports_count,
    }),
);

export const segmentRootLookupItemFromJson = json.object<JsonObject<WorkPackageInfo>, WorkPackageInfo>(
  {
    work_package_hash: fromJson.bytes32(),
    segment_tree_root: fromJson.bytes32(),
  },
  ({ work_package_hash, segment_tree_root }) =>
    WorkPackageInfo.create({ workPackageHash: work_package_hash, segmentTreeRoot: segment_tree_root }),
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
    auth_gas_used: json.fromNumber((x) => tryAsServiceGas(x)),
  },
  ({
    package_spec,
    context,
    core_index,
    authorizer_hash,
    auth_output,
    results,
    segment_root_lookup,
    auth_gas_used,
  }) => {
    const fixedSizeResults = FixedSizeArray.new(results, tryAsWorkItemsCount(results.length));
    return WorkReport.create({
      workPackageSpec: package_spec,
      context,
      coreIndex: core_index,
      authorizerHash: authorizer_hash,
      authorizationOutput: auth_output,
      segmentRootLookup: segment_root_lookup,
      results: fixedSizeResults,
      authorizationGasUsed: auth_gas_used,
    });
  },
);

type JsonWorkReport = {
  package_spec: WorkPackageSpec;
  context: RefineContext;
  core_index: CoreIndex;
  authorizer_hash: AuthorizerHash;
  auth_output: BytesBlob;
  segment_root_lookup: WorkPackageInfo[];
  results: WorkResult[];
  auth_gas_used: ServiceGas;
};
