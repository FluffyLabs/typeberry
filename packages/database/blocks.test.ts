import assert from "node:assert";
import { describe, it } from "node:test";
import { Header, type HeaderHash } from "@typeberry/block";
import { testBlockView } from "@typeberry/block/test-helpers";
import { Bytes } from "@typeberry/bytes";
import { Encoder } from "@typeberry/codec";
import { tinyChainSpec } from "@typeberry/config";
import { HASH_SIZE, WithHash, hashBytes } from "@typeberry/hash";
import { InMemoryBlocks } from ".";

describe("InMemoryDatabase", () => {
  it("should set and retrieve best header hash", () => {
    const db = new InMemoryBlocks();

    db.setBestHeaderHash(Bytes.fill(HASH_SIZE, 5) as HeaderHash);

    assert.strictEqual(
      db.getBestHeaderHash().toString(),
      "0x0505050505050505050505050505050505050505050505050505050505050505",
    );
  });

  it("should store and retrieve a block", () => {
    const db = new InMemoryBlocks();
    const block = testBlockView();
    const headerHash = hashBytes(Encoder.encodeObject(Header.Codec, block.header(), tinyChainSpec)) as HeaderHash;
    db.insertBlock(new WithHash(headerHash, block));

    assert.deepStrictEqual(db.getHeader(headerHash)?.materialize(), block.header());
    assert.deepStrictEqual(db.getExtrinsic(headerHash)?.materialize(), block.extrinsic());
  });
});
