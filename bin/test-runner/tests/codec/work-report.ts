import assert from "node:assert";
import fs from "node:fs";
import { CodecContext } from "@typeberry/block/context";
import { WorkPackageSpec, WorkReport } from "@typeberry/block/work-report";
import { BytesBlob } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import { json } from "@typeberry/json-parser";
import { bytes32 } from ".";
import type { JsonObject } from "../../json-format";
import { refineContextFromJson } from "./refine-context";
import { workResultFromJson } from "./work-result";

const workPackageSpecFromJson = json.object<JsonObject<WorkPackageSpec>, WorkPackageSpec>(
  {
    hash: bytes32(),
    len: "number",
    erasure_root: bytes32(),
    exports_root: bytes32(),
  },
  ({ hash, len, erasure_root, exports_root }) => new WorkPackageSpec(hash, len, erasure_root, exports_root),
);

export const workReportFromJson = json.object<JsonObject<WorkReport>, WorkReport>(
  {
    package_spec: workPackageSpecFromJson,
    context: refineContextFromJson,
    core_index: "number",
    authorizer_hash: bytes32(),
    auth_output: json.fromString(BytesBlob.parseBlob),
    results: json.array(workResultFromJson),
  },
  ({ package_spec, context, core_index, authorizer_hash, auth_output, results }) =>
    new WorkReport(package_spec, context, core_index, authorizer_hash, auth_output, results),
);

export async function runWorkReportTest(test: WorkReport, file: string) {
  const encoded = new Uint8Array(fs.readFileSync(file.replace("json", "bin")));

  const myEncoded = Encoder.encodeObject(WorkReport.Codec, test, new CodecContext());
  assert.deepStrictEqual(myEncoded.toString(), BytesBlob.fromBlob(encoded).toString());

  const decoded = Decoder.decodeObject(WorkReport.Codec, encoded, new CodecContext());
  assert.deepStrictEqual(decoded, test);
}
