import assert from "node:assert";
import { describe, it } from "node:test";

describe("Basic Usage Examples", () => {
  it("should demonstrate importing from @typeberry/lib", async () => {
    // <!-- example:basic-import -->
    // Import from @typeberry/lib using subpath imports
    const config = await import("@typeberry/lib/config");
    const { Decoder } = await import("@typeberry/lib/codec");
    const { InMemoryState } = await import("@typeberry/lib/state");
    const { BytesBlob } = await import("@typeberry/lib/bytes");
    const { Block, tryAsServiceId } = await import("@typeberry/lib/block");

    // create empty in-memory state representation
    const state = InMemoryState.empty(config.tinyChainSpec);
    assert.equal(state.entropy.length, 4);
    assert.equal(state.getService(tryAsServiceId(0)), null);

    // attempt to decode block from an empty blob
    assert.throws(() => {
      Decoder.decodeObject(Block.Codec, BytesBlob.empty());
    });
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
