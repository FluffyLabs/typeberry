import assert from "node:assert";
import fs from "node:fs";
import { BytesBlob } from "@typeberry/bytes";
import { type Codec, Decoder, Encoder } from "@typeberry/codec";
import { tinyChainSpec } from "@typeberry/config";

/**
 * Verifies that a codec correctly encodes and decodes a test object by comparing results against a reference binary file.
 *
 * Reads a binary file corresponding to the provided JSON filename, encodes the test object using the given codec and configuration, and asserts that the encoded output matches the file contents. Then decodes the binary data and asserts that the result matches the original test object.
 *
 * @param codec - The codec used for encoding and decoding.
 * @param test - The object to be encoded and decoded.
 * @param file - The path to the reference JSON file; the corresponding binary file is used for comparison.
 */
export function runCodecTest<T>(codec: Codec<T>, test: T, file: string) {
  const encoded = new Uint8Array(fs.readFileSync(file.replace("json", "bin")));
  const myEncoded = Encoder.encodeObject(codec, test, tinyChainSpec);
  assert.deepStrictEqual(myEncoded.toString(), BytesBlob.blobFrom(encoded).toString());

  const decoded = Decoder.decodeObject(codec, BytesBlob.blobFrom(encoded), tinyChainSpec);
  assert.deepStrictEqual(decoded, test);
}
