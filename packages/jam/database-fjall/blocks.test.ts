import assert from "node:assert";
import * as fs from "node:fs";
import { afterEach, before, beforeEach, describe, it } from "node:test";
import { testBlockView } from "@typeberry/block/test-helpers.js";
import { Bytes } from "@typeberry/bytes";
import { tinyChainSpec } from "@typeberry/config";
import { Blake2b, HASH_SIZE, WithHash } from "@typeberry/hash";
import { FjallBlocks } from "./blocks.js";
import { FjallRoot } from "./root.js";

let blake2b: Blake2b;

before(async () => {
  blake2b = await Blake2b.createHasher();
});

describe("Fjall blocks database", () => {
  let tmpDir = "";

  beforeEach(() => {
    tmpDir = fs.mkdtempSync("typeberry-fjall-blocks-");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("sets and retrieves the best header hash", async () => {
    const root = await FjallRoot.open(tmpDir, { ephemeral: true });
    const blocks = await FjallBlocks.open(tinyChainSpec, root);
    try {
      await blocks.setBestHeaderHash(Bytes.fill(HASH_SIZE, 5).asOpaque());

      assert.strictEqual(
        blocks.getBestHeaderHash().toString(),
        "0x0505050505050505050505050505050505050505050505050505050505050505",
      );
    } finally {
      await blocks.close();
      await root.close();
    }
  });

  it("sets and retrieves post state roots", async () => {
    const root = await FjallRoot.open(tmpDir, { ephemeral: true });
    const blocks = await FjallBlocks.open(tinyChainSpec, root);
    try {
      await blocks.setPostStateRoot(Bytes.fill(HASH_SIZE, 5).asOpaque(), Bytes.fill(HASH_SIZE, 10).asOpaque());

      assert.strictEqual(blocks.getPostStateRoot(Bytes.fill(HASH_SIZE, 1).asOpaque())?.toString(), undefined);
      assert.strictEqual(
        blocks.getPostStateRoot(Bytes.fill(HASH_SIZE, 5).asOpaque())?.toString(),
        "0x0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a",
      );
    } finally {
      await blocks.close();
      await root.close();
    }
  });

  it("stores and retrieves a block", async () => {
    const root = await FjallRoot.open(tmpDir, { ephemeral: true });
    const blocks = await FjallBlocks.open(tinyChainSpec, root);
    try {
      const block = testBlockView();
      const headerHash = blake2b.hashBytes(block.header.view().encoded()).asOpaque();
      await blocks.insertBlock(WithHash.new(headerHash, block));

      assert.deepStrictEqual(blocks.getHeader(headerHash)?.materialize(), block.header.materialize());
      assert.deepStrictEqual(blocks.getExtrinsic(headerHash)?.materialize(), block.extrinsic.materialize());
    } finally {
      await blocks.close();
      await root.close();
    }
  });
});
