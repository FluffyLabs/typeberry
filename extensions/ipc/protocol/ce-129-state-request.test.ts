import assert from "node:assert";
import { describe, it } from "node:test";
import type { HeaderHash } from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { HASH_SIZE, hashString } from "@typeberry/hash";
import { MessageHandler, type MessageSender } from "../handler";
import { Handler, KEY_SIZE, KeyValuePair, STREAM_KIND } from "./ce-129-state-request";

const HEADER_HASH = Bytes.fromBlob(
  hashString("0x7e1b07b8039cf840d51c4825362948c8ecb8fce1d290f705c269b6bcc7992731").raw,
  HASH_SIZE,
) as HeaderHash;
const KEY = Bytes.fromBlob(hashString("0x83bd3bde264a79a2e67c487696c1d7f0b549da89").raw.subarray(0, 31), 31);
const EXPECTED_VALUE = BytesBlob.fromNumbers([255, 255, 255, 0]);

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

describe("CE 129: State Request", () => {
  it("sends a state request and receives a response", async () => {
    const handlers = {} as { client: MessageHandler; server: MessageHandler };
    handlers.client = new MessageHandler(
      new FakeMessageSender(
        (data) => {
          handlers.server.onSocketMessage(data.buffer);
        },
        () => {
          handlers.server.onClose();
        },
      ),
    );
    handlers.server = new MessageHandler(
      new FakeMessageSender(
        (data) => {
          handlers.client.onSocketMessage(data.buffer);
        },
        () => {
          handlers.client.onClose();
        },
      ),
    );

    handlers.server.registerHandlers(new Handler(true, getBoundaryNodes, getKeyValuePairs));
    handlers.client.registerHandlers(new Handler());

    const receivedData: KeyValuePair[] = await new Promise((resolve) => {
      handlers.client.withNewStream(STREAM_KIND, (handler: Handler, sender) => {
        handler.getStateByKey(sender, HEADER_HASH, KEY, (response) => {
          resolve(response.keyValuePairs);
        });
      });
    });

    assert.deepStrictEqual(receivedData, [new KeyValuePair(KEY, EXPECTED_VALUE)]);
  });
});

const getBoundaryNodes = () => {
  return [];
};

const getKeyValuePairs = (_hash: HeaderHash, startKey: Bytes<KEY_SIZE>) => {
  let value = BytesBlob.fromNumbers([255, 255, 0, 0]);
  if (
    Bytes.fromBlob(
      hashString("0x83bd3bde264a79a2e67c487696c1d7f0b549da89").raw.subarray(0, KEY_SIZE),
      KEY_SIZE,
    ).isEqualTo(startKey)
  ) {
    value = EXPECTED_VALUE;
  }
  return [new KeyValuePair(startKey, value)];
};
