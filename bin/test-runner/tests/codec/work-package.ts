import assert from "node:assert";
import fs from "node:fs";
import { CodecContext } from "@typeberry/block/context";
import { Authorizer, WorkPackage } from "@typeberry/block/work-package";
import { BytesBlob } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import { json } from "@typeberry/json-parser";
import { bytes32 } from ".";
import type { JsonObject } from "../../json-format";
import { refineContextFromJson } from "./refine-context";
import { workItemFromJson } from "./work-item";

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
    items: json.array(workItemFromJson),
  },
  ({ authorization, auth_code_host, authorizer, context, items }) =>
    new WorkPackage(authorization, auth_code_host, authorizer, context, items),
);

export async function runWorkPackageTest(test: WorkPackage, file: string) {
  const encoded = new Uint8Array(fs.readFileSync(file.replace("json", "bin")));

  const myEncoded = Encoder.encodeObject(WorkPackage.Codec, test, new CodecContext());
  assert.deepStrictEqual(myEncoded.toString(), BytesBlob.fromBlob(encoded).toString());

  const decoded = Decoder.decodeObject(WorkPackage.Codec, encoded, new CodecContext());
  assert.deepStrictEqual(decoded, test);
}
