import assert from "node:assert";
import fs from "node:fs";
import { Authorizer, WorkPackage } from "@typeberry/block/work_package";
import { WorkReport } from "@typeberry/block/work_report";
import { BytesBlob } from "@typeberry/bytes";
import { Decoder } from "@typeberry/codec";
import { json } from "@typeberry/json-parser";
import { bytes32 } from ".";
import type { JsonObject } from "../../json-format";
import { refineContextFromJson } from "./refine_context";
import { workItemFromJson } from "./work_item";

const authorizerFromJson = json.object<JsonObject<Authorizer>, Authorizer>(
  {
    code_hash: bytes32(),
    params: json.fromString(BytesBlob.parseBlob),
  },
  ({ code_hash, params }) => new Authorizer(code_hash, params),
);

export const workPackageFromJson = json.object<JsonObject<WorkPackage>, WorkPackage>(
  {
    authorization: json.fromString(BytesBlob.parseBlob),
    auth_code_host: "number",
    authorizer: authorizerFromJson,
    context: refineContextFromJson,
    // TODO [ToDr] should we have a validator to make sure the length is okay?
    items: json.array(workItemFromJson),
  },
  ({ authorization, auth_code_host, authorizer, context, items }) =>
    new WorkPackage(authorization, auth_code_host, authorizer, context, items),
);

export async function runWorkPackageTest(test: WorkPackage, file: string) {
  const encoded = new Uint8Array(fs.readFileSync(file.replace("json", "bin")));
  const decoded = Decoder.decodeObject(WorkReport.Codec, encoded);

  assert.deepStrictEqual(decoded, test);
}
