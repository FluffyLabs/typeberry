import assert from "node:assert";
import { describe, it } from "node:test";

describe("Codec Examples", () => {
  it("should demonstrate JAM/GP encoding and decoding with simple types", async () => {
    // <!-- example:codec-basic -->
    const { codec, Encoder, Decoder } = await import("@typeberry/lib/codec");

    // Define a schema for fixed-size bytes
    const hashSchema = codec.bytes(32);

    // Create test data
    const { Bytes } = await import("@typeberry/lib/bytes");
    const testHash = Bytes.fill(32, 0x42);

    // Encode data
    const encoded = Encoder.encodeObject(hashSchema, testHash);

    // Decode data
    const decoded = Decoder.decodeObject(hashSchema, encoded);

    assert.deepStrictEqual(decoded, testHash);
    // <!-- /example:codec-basic -->
  });
});
