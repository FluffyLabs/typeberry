import type { CodeHash, ServiceGas, ServiceId } from "@typeberry/block";
import { ImportSpec, WorkItem, WorkItemExtrinsicSpec } from "@typeberry/block/work-item";
import { BytesBlob } from "@typeberry/bytes";
import type { KnownSizeArray } from "@typeberry/collections";
import { json } from "@typeberry/json-parser";
import type { U16 } from "@typeberry/numbers";
import type { JsonObject } from "../../json-format";
import { fromJson, runCodecTest } from "./common";

const importSpecFromJson = json.object<JsonObject<ImportSpec>, ImportSpec>(
  {
    tree_root: fromJson.bytes32(),
    index: "number",
  },
  ({ tree_root, index }) => new ImportSpec(tree_root, index),
);

const workItemExtrinsicSpecFromJson = json.object<WorkItemExtrinsicSpec>(
  {
    hash: fromJson.bytes32(),
    len: "number",
  },
  ({ hash, len }) => new WorkItemExtrinsicSpec(hash, len),
);

export const workItemFromJson = json.object<JsonWorkItem, WorkItem>(
  {
    service: "number",
    code_hash: fromJson.bytes32(),
    payload: json.fromString(BytesBlob.parseBlob),
    gas_limit: "number",
    import_segments: json.array(importSpecFromJson),
    extrinsic: json.array(workItemExtrinsicSpecFromJson),
    export_count: "number",
  },
  ({ service, code_hash, payload, gas_limit, import_segments, extrinsic, export_count }) =>
    new WorkItem(
      service,
      code_hash,
      payload,
      BigInt(gas_limit) as ServiceGas,
      import_segments,
      extrinsic,
      export_count,
    ),
);

type JsonWorkItem = {
  service: ServiceId;
  code_hash: CodeHash;
  payload: BytesBlob;
  gas_limit: number;
  import_segments: KnownSizeArray<ImportSpec, "Less than 2**11">;
  extrinsic: WorkItemExtrinsicSpec[];
  export_count: U16;
};

export async function runWorkItemTest(test: WorkItem, file: string) {
  runCodecTest(WorkItem.Codec, test, file);
}
