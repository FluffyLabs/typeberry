import type { HASH_SIZE, ServiceGas, ServiceId } from "@typeberry/block";
import { ExtrinsicSpec, ImportSpec, WorkItem } from "@typeberry/block/work-item";
import { type Bytes, BytesBlob } from "@typeberry/bytes";
import { json } from "@typeberry/json-parser";
import type { U16 } from "@typeberry/numbers";
import { fromJson, runCodecTest } from ".";
import type { JsonObject } from "../../json-format";

const importSpecFromJson = json.object<JsonObject<ImportSpec>, ImportSpec>(
  {
    tree_root: fromJson.bytes32(),
    index: "number",
  },
  ({ tree_root, index }) => new ImportSpec(tree_root, index),
);

const extrinsicSpecFromJson = json.object<ExtrinsicSpec>(
  {
    hash: fromJson.bytes32(),
    len: "number",
  },
  ({ hash, len }) => new ExtrinsicSpec(hash, len),
);

export const workItemFromJson = json.object<JsonWorkItem, WorkItem>(
  {
    service: "number",
    code_hash: fromJson.bytes32(),
    payload: json.fromString(BytesBlob.parseBlob),
    gas_limit: "number",
    import_segments: json.array(importSpecFromJson),
    extrinsic: json.array(extrinsicSpecFromJson),
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
  code_hash: Bytes<typeof HASH_SIZE>;
  payload: BytesBlob;
  gas_limit: number;
  import_segments: ImportSpec[];
  extrinsic: ExtrinsicSpec[];
  export_count: U16;
};

export async function runWorkItemTest(test: WorkItem, file: string) {
  runCodecTest(WorkItem.Codec, test, file);
}
