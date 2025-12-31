import assert from "node:assert";
import { describe, it } from "node:test";

describe("Basic Usage Examples", () => {
  it("should demonstrate importing from @typeberry/lib", async () => {
    // <!-- example:basic-import -->
    // Import from @typeberry/lib using subpath imports
    const { Blake2b } = await import("@typeberry/lib/hash");
    const { codec } = await import("@typeberry/lib/codec");
    const { BytesBlob, Bytes } = await import("@typeberry/lib/bytes");
    const { tryAsU8 } = await import("@typeberry/lib/numbers");

    // All imports work with both ESM and CommonJS
    assert.ok(Blake2b);
    assert.ok(codec);
    assert.ok(BytesBlob);
    assert.ok(Bytes);
    assert.ok(tryAsU8);
    // <!-- /example:basic-import -->
  });

  it("should demonstrate working with numbers", async () => {
    // <!-- example:numbers -->
    const { tryAsU8, tryAsU32, isU8 } = await import("@typeberry/lib/numbers");

    // Create typed numbers
    const smallNumber = tryAsU8(42);
    const largeNumber = tryAsU32(1000000);

    // Type checking
    assert.ok(isU8(42));
    assert.strictEqual(smallNumber, 42);
    assert.strictEqual(largeNumber, 1000000);
    // <!-- /example:numbers -->
  });
});
