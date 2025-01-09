import assert from "node:assert";
import { describe, it } from "node:test";
import type { Block, HeaderHash } from "@typeberry/block";
import { testBlock } from "@typeberry/block/test-helpers";
import type { BytesBlob } from "@typeberry/bytes";
import { tinyChainSpec } from "@typeberry/config";
import { blake2b } from "@typeberry/hash";
import type { U32 } from "@typeberry/numbers";
import { MessageHandler, type MessageSender } from "../handler";
import { ClientHandler, Direction, STREAM_KIND, ServerHandler } from "./ce-128-block-request";

const HEADER_HASH: HeaderHash = blake2b
  .hashString("0x7e1b07b8039cf840d51c4825362948c8ecb8fce1d290f705c269b6bcc7992731")
  .asOpaque();
const MAX_BLOCKS = 10 as U32;
const TEST_BLOCK = testBlock();

class FakeMessageSender implements MessageSender {
  constructor(
    public readonly onMessage: (data: BytesBlob) => void,
    public readonly onClose: () => void,
  ) {}

  send(data: BytesBlob): void {
    setImmediate(() => {
      this.onMessage(data);
    });
  }

  close(): void {
    setImmediate(() => {
      this.onClose();
    });
  }
}

describe("CE 128: Block Request", () => {
  it("sends a block request and receives a sequence of blocks", async () => {
    const handlers = {} as { client: MessageHandler; server: MessageHandler };
    handlers.client = new MessageHandler(
      new FakeMessageSender(
        (data) => {
          handlers.server.onSocketMessage(data.raw);
        },
        () => {
          handlers.server.onClose({});
        },
      ),
    );
    handlers.server = new MessageHandler(
      new FakeMessageSender(
        (data) => {
          handlers.client.onSocketMessage(data.raw);
        },
        () => {
          handlers.client.onClose({});
        },
      ),
    );

    handlers.server.registerHandlers(new ServerHandler(tinyChainSpec, getBlockSequence));
    handlers.client.registerHandlers(new ClientHandler(tinyChainSpec));

    const receivedData: Block[] = await new Promise((resolve) => {
      handlers.client.withNewStream(STREAM_KIND, (handler: ClientHandler, sender) => {
        handler.getBlockSequence(sender, HEADER_HASH, Direction.DescIncl, MAX_BLOCKS).then((blocks) => resolve(blocks));
      });
    });

    assert.deepStrictEqual(receivedData, [TEST_BLOCK, TEST_BLOCK]);
  });
});

const getBlockSequence = (_hash: HeaderHash, _direction: Direction, _maxBlocks: U32): Block[] => {
  return [TEST_BLOCK, TEST_BLOCK];
};
