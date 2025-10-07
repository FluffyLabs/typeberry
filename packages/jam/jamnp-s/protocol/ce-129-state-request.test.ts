import assert from "node:assert";
import { before, describe, it } from "node:test";
import type { HeaderHash } from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { Blake2b } from "@typeberry/hash";
import { TRUNCATED_KEY_BYTES } from "@typeberry/trie/nodes.js";
import { OK } from "@typeberry/utils";
import { Handler, type Key, KeyValuePair, STREAM_KIND } from "./ce-129-state-request.js";
import { testClientServer } from "./test-utils.js";

let HEADER_HASH: HeaderHash;
let KEY: Bytes<typeof TRUNCATED_KEY_BYTES>;

before(async () => {
  const blake2b = await Blake2b.createHasher();
  HEADER_HASH = blake2b.hashString("0x7e1b07b8039cf840d51c4825362948c8ecb8fce1d290f705c269b6bcc7992731").asOpaque();
  KEY = Bytes.fromBlob(
    blake2b.hashString("0x83bd3bde264a79a2e67c487696c1d7f0b549da89").raw.subarray(0, TRUNCATED_KEY_BYTES),
    TRUNCATED_KEY_BYTES,
  );
});

const EXPECTED_VALUE = BytesBlob.blobFromNumbers([255, 255, 255, 0]);

describe("CE 129: State Request", () => {
  it("sends a state request and receives a response", async () => {
    const handlers = testClientServer();

    handlers.server.registerHandlers(new Handler(true, getBoundaryNodes, getKeyValuePairs));
    handlers.client.registerHandlers(new Handler());

    const receivedData: KeyValuePair[] = await new Promise((resolve) => {
      handlers.client.withNewStream(STREAM_KIND, (handler: Handler, sender) => {
        handler.getStateByKey(sender, HEADER_HASH, KEY, (response) => {
          resolve(response.keyValuePairs);
        });
        return OK;
      });
    });

    assert.deepStrictEqual(receivedData, [new KeyValuePair(KEY, EXPECTED_VALUE)]);
  });
});

const getBoundaryNodes = () => {
  return [];
};

const getKeyValuePairs = (_hash: HeaderHash, startKey: Key) => {
  let value = BytesBlob.blobFromNumbers([255, 255, 0, 0]);
  if (KEY.isEqualTo(startKey)) {
    value = EXPECTED_VALUE;
  }
  return [new KeyValuePair(startKey, value)];
};
