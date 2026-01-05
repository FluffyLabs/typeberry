import assert from "node:assert";
import { describe, it } from "node:test";

describe("Bytes Examples", () => {
  it("should demonstrate hex string parsing", async () => {
    // <!-- example:bytes-parsing -->
    const { BytesBlob } = await import("@typeberry/lib/bytes");

    // Parse hex string with 0x prefix
    const hexString = "0x48656c6c6f";
    const bytes = BytesBlob.parseBlob(hexString);

    // Convert to regular Uint8Array
    const data = bytes.raw;

    // Verify the data
    const text = new TextDecoder().decode(data);
    assert.strictEqual(text, "Hello");
    // <!-- /example:bytes-parsing -->
  });

  it("should demonstrate creating bytes from data", async () => {
    // <!-- example:bytes-create -->
    const { Bytes } = await import("@typeberry/lib/bytes");

    // Create fixed-size bytes
    const data = Bytes.fill(32, 0x42);

    assert.strictEqual(data.length, 32);
    assert.strictEqual(data.raw[0], 0x42);
    // <!-- /example:bytes-create -->
  });
});
