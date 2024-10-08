import assert from "node:assert";
import fs from "node:fs";
import type { ServiceId } from "@typeberry/block/preimage";
import { ExtrinsicSpec, ImportSpec, WorkItem } from "@typeberry/block/work_item";
import type { Gas } from "@typeberry/block/work_result";
import { type Bytes, BytesBlob } from "@typeberry/bytes";
import { Decoder } from "@typeberry/codec";
import { json } from "@typeberry/json-parser";
import type { U16 } from "@typeberry/numbers";
import { bytes32 } from ".";
import type { JsonObject } from "../../json-format";

const importSpecFromJson = json.object<JsonObject<ImportSpec>, ImportSpec>(
  {
    tree_root: bytes32(),
    index: "number",
  },
  ({ tree_root, index }) => new ImportSpec(tree_root, index),
);

const extrinsicSpecFromJson = json.object<ExtrinsicSpec>(
  {
    hash: bytes32(),
    len: "number",
  },
  ({ hash, len }) => new ExtrinsicSpec(hash, len),
);

export const workItemFromJson = json.object<JsonWorkItem, WorkItem>(
  {
    service: "number",
    code_hash: bytes32(),
    payload: json.fromString(BytesBlob.parseBlob),
    gas_limit: "number",
    import_segments: json.array(importSpecFromJson),
    extrinsic: json.array(extrinsicSpecFromJson),
    export_count: "number",
  },
  ({ service, code_hash, payload, gas_limit, import_segments, extrinsic, export_count }) =>
    new WorkItem(service, code_hash, payload, BigInt(gas_limit) as Gas, import_segments, extrinsic, export_count),
);

type JsonWorkItem = {
  service: ServiceId;
  code_hash: Bytes<32>;
  payload: BytesBlob;
  gas_limit: number;
  import_segments: ImportSpec[];
  extrinsic: ExtrinsicSpec[];
  export_count: U16;
};

export async function runWorkItemTest(test: WorkItem, file: string) {
  const encoded = new Uint8Array(fs.readFileSync(file.replace("json", "bin")));
  const decoded = Decoder.decodeObject(WorkItem.Codec, encoded);

  assert.deepStrictEqual(decoded, test);
}
