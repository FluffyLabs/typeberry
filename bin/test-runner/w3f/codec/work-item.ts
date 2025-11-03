import { type CodeHash, type ServiceId, tryAsServiceGas } from "@typeberry/block";
import { ImportSpec, WorkItem, WorkItemExtrinsicSpec } from "@typeberry/block/work-item.js";
import { fromJson, type JsonObject } from "@typeberry/block-json";
import { BytesBlob } from "@typeberry/bytes";
import { json } from "@typeberry/json-parser";
import type { U16 } from "@typeberry/numbers";
import type { RunOptions } from "../../common.js";
import { runCodecTest } from "./common.js";

const importSpecFromJson = json.object<JsonObject<ImportSpec>, ImportSpec>(
  {
    tree_root: fromJson.bytes32(),
    index: "number",
  },
  ({ tree_root, index }) => ImportSpec.create({ treeRoot: tree_root, index }),
);

const workItemExtrinsicSpecFromJson = json.object<WorkItemExtrinsicSpec>(
  {
    hash: fromJson.bytes32(),
    len: "number",
  },
  ({ hash, len }) => WorkItemExtrinsicSpec.create({ hash, len }),
);

export const workItemFromJson = json.object<JsonWorkItem, WorkItem>(
  {
    service: "number",
    code_hash: fromJson.bytes32(),
    payload: json.fromString(BytesBlob.parseBlob),
    refine_gas_limit: "number",
    accumulate_gas_limit: "number",
    import_segments: json.array(importSpecFromJson),
    extrinsic: json.array(workItemExtrinsicSpecFromJson),
    export_count: "number",
  },
  ({ service, code_hash, payload, refine_gas_limit, accumulate_gas_limit, import_segments, extrinsic, export_count }) =>
    WorkItem.create({
      service,
      codeHash: code_hash,
      payload,
      refineGasLimit: tryAsServiceGas(refine_gas_limit),
      accumulateGasLimit: tryAsServiceGas(accumulate_gas_limit),
      importSegments: import_segments,
      extrinsic,
      exportCount: export_count,
    }),
);

type JsonWorkItem = {
  service: ServiceId;
  code_hash: CodeHash;
  payload: BytesBlob;
  refine_gas_limit: number;
  accumulate_gas_limit: number;
  import_segments: WorkItem["importSegments"];
  extrinsic: WorkItemExtrinsicSpec[];
  export_count: U16;
};

export async function runWorkItemTest(test: WorkItem, { path }: RunOptions) {
  runCodecTest(WorkItem.Codec, test, path);
}
