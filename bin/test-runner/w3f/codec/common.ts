import assert from "node:assert";
import fs from "node:fs";
import { BytesBlob } from "@typeberry/bytes";
import { type Codec, Decoder, Encoder } from "@typeberry/codec";
import { tinyChainSpec } from "@typeberry/config";

export function runCodecTest<T>(codec: Codec<T>, test: T, file: string) {
  const encoded = new Uint8Array(fs.readFileSync(file.replace("json", "bin")));
  const myEncoded = Encoder.encodeObject(codec, test, tinyChainSpec);
  assert.deepStrictEqual(myEncoded.toString(), BytesBlob.blobFrom(encoded).toString());

  const decoded = Decoder.decodeObject(codec, BytesBlob.blobFrom(encoded), tinyChainSpec);
  assert.deepStrictEqual(decoded, test);
}
