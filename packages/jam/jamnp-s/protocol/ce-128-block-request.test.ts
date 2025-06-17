import assert from "node:assert";
import { describe, it } from "node:test";
import type { Block, HeaderHash } from "@typeberry/block";
import { testBlock } from "@typeberry/block/test-helpers.js";
import { tinyChainSpec } from "@typeberry/config";
import { blake2b } from "@typeberry/hash";
import { type U32, tryAsU32 } from "@typeberry/numbers";
import { OK } from "@typeberry/utils";
import { ClientHandler, Direction, STREAM_KIND, ServerHandler } from "./ce-128-block-request.js";
import { testClientServer } from "./test-utils.js";

const HEADER_HASH: HeaderHash = blake2b
  .hashString("0x7e1b07b8039cf840d51c4825362948c8ecb8fce1d290f705c269b6bcc7992731")
  .asOpaque();
const MAX_BLOCKS = tryAsU32(10);
const TEST_BLOCK = testBlock();

describe("CE 128: Block Request", () => {
  it("sends a block request and receives a sequence of blocks", async () => {
    const handlers = testClientServer();

    handlers.server.registerHandlers(new ServerHandler(tinyChainSpec, getBlockSequence));
    handlers.client.registerHandlers(new ClientHandler(tinyChainSpec));

    const receivedData: Block[] = await new Promise((resolve) => {
      handlers.client.withNewStream(STREAM_KIND, (handler: ClientHandler, sender) => {
        handler.getBlockSequence(sender, HEADER_HASH, Direction.DescIncl, MAX_BLOCKS).then((blocks) => resolve(blocks));
        return OK;
      });
    });

    assert.deepStrictEqual(receivedData, [TEST_BLOCK, TEST_BLOCK]);
  });
});

const getBlockSequence = (_hash: HeaderHash, _direction: Direction, _maxBlocks: U32): Block[] => {
  return [TEST_BLOCK, TEST_BLOCK];
};
