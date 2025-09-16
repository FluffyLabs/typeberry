import assert from "node:assert";
import { describe, it } from "node:test";
import type { BlockView, HeaderHash } from "@typeberry/block";
import { testBlockView } from "@typeberry/block/test-helpers.js";
import { tinyChainSpec } from "@typeberry/config";
import { blake2b } from "@typeberry/hash";
import { tryAsU32, type U32 } from "@typeberry/numbers";
import { OK } from "@typeberry/utils";
import { ClientHandler, Direction, ServerHandler, STREAM_KIND } from "./ce-128-block-request.js";
import type { StreamId } from "./stream.js";
import { testClientServer } from "./test-utils.js";

const HEADER_HASH: HeaderHash = blake2b
  .hashString("0x7e1b07b8039cf840d51c4825362948c8ecb8fce1d290f705c269b6bcc7992731")
  .asOpaque();
const MAX_BLOCKS = tryAsU32(10);
const TEST_BLOCK_VIEW = testBlockView();

describe("CE 128: Block Request", () => {
  it("sends a block request and receives a sequence of blocks", async () => {
    const handlers = testClientServer();

    handlers.server.registerHandlers(new ServerHandler(tinyChainSpec, getBlockSequence));
    handlers.client.registerHandlers(new ClientHandler(tinyChainSpec));

    const receivedData: BlockView[] = await new Promise((resolve) => {
      handlers.client.withNewStream(STREAM_KIND, (handler: ClientHandler, sender) => {
        (async () => {
          const blocks = await handler.requestBlockSequence(sender, HEADER_HASH, Direction.DescIncl, MAX_BLOCKS);
          resolve(blocks);
        })();
        return OK;
      });
    });

    assert.deepStrictEqual(
      `${receivedData.map((x) => x.encoded())}`,
      `${[TEST_BLOCK_VIEW, TEST_BLOCK_VIEW].map((x) => x.encoded())}`,
    );
  });
});

const getBlockSequence = (
  _streamId: StreamId,
  _hash: HeaderHash,
  _direction: Direction,
  _maxBlocks: U32,
): BlockView[] => {
  return [TEST_BLOCK_VIEW, TEST_BLOCK_VIEW];
};
