import assert from "node:assert";
import fs from "node:fs";
import { CodecContext } from "@typeberry/block/context";
import { Preimage, type PreimagesExtrinsic, preimagesExtrinsicCodec } from "@typeberry/block/preimage";
import { BytesBlob } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import { json } from "@typeberry/json-parser";

const preimageFromJson = json.object<Preimage>(
  {
    requester: "number",
    blob: json.fromString(BytesBlob.parseBlob),
  },
  ({ requester, blob }) => new Preimage(requester, blob),
);

export const preimagesExtrinsicFromJson = json.array(preimageFromJson);

export async function runPreimagesExtrinsicTest(test: PreimagesExtrinsic, file: string) {
  const encoded = new Uint8Array(fs.readFileSync(file.replace("json", "bin")));

  const myEncoded = Encoder.encodeObject(preimagesExtrinsicCodec, test, new CodecContext());
  assert.deepStrictEqual(myEncoded.toString(), BytesBlob.fromBlob(encoded).toString());

  const decoded = Decoder.decodeObject(preimagesExtrinsicCodec, encoded, new CodecContext());
  assert.deepStrictEqual(decoded, test);
}
