import assert from "node:assert";
import fs from "node:fs";
import { BytesBlob } from "@typeberry/bytes";
import { type Codec, Decoder, Encoder } from "@typeberry/codec";
import { fullChainSpec, tinyChainSpec } from "@typeberry/config";

export function runCodecTest<T>(codec: Codec<T>, test: T, file: string) {
  const spec = getChainSpec(file);
  const encoded = new Uint8Array(fs.readFileSync(file.replace("json", "bin")));
  const myEncoded = Encoder.encodeObject(codec, test, spec);
  assert.deepStrictEqual(myEncoded.toString(), BytesBlob.blobFrom(encoded).toString());

  const decoded = Decoder.decodeObject(codec, BytesBlob.blobFrom(encoded), spec);
  assert.deepStrictEqual(decoded, test);
}

function getChainSpec(file: string) {
  if (file.includes('/tiny/')) {
    return tinyChainSpec;
  }

  if (file.includes('/full/')) {
    return fullChainSpec
  }

  throw new Error(`Cannot match a chain spec for: ${file}`);
}
