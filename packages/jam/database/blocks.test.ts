import assert from "node:assert";
import { describe, it } from "node:test";
import { testBlockView } from "@typeberry/block/test-helpers";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE, WithHash, blake2b } from "@typeberry/hash";
import { InMemoryBlocks } from ".";

describe("InMemoryDatabase", () => {
  it("should set and retrieve best header hash", () => {
    const db = new InMemoryBlocks();

    db.setBestHeaderHash(Bytes.fill(HASH_SIZE, 5).asOpaque());

    assert.strictEqual(
      db.getBestHeaderHash().toString(),
      "0x0505050505050505050505050505050505050505050505050505050505050505",
    );
  });

  it("should store and retrieve a block", () => {
    const db = new InMemoryBlocks();
    const block = testBlockView();
    const headerHash = blake2b.hashBytes(block.header.view().encoded()).asOpaque();
    db.insertBlock(new WithHash(headerHash, block));

    assert.deepStrictEqual(db.getHeader(headerHash)?.materialize(), block.header.materialize());
    assert.deepStrictEqual(db.getExtrinsic(headerHash)?.materialize(), block.extrinsic.materialize());
  });
});
