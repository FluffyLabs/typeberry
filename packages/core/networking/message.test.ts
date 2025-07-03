import assert from "node:assert";
import { describe, it } from "node:test";
import { encodeMessageLength, handleMessageFragmentation, MSG_LEN_PREFIX_BYTES } from "./message.js";

describe("encodeMessageLength", () => {
  it("should encode message length for normal message", () => {
    const message = new Uint8Array([0x01, 0x02, 0x03, 0x04]);

    const result = encodeMessageLength(message);

    assert.strictEqual(result.length, MSG_LEN_PREFIX_BYTES);
    assert.strictEqual(result[0], 4); // length = 4 in little endian
    assert.strictEqual(result[1], 0);
    assert.strictEqual(result[2], 0);
    assert.strictEqual(result[3], 0);
  });

  it("should encode message length for empty message", () => {
    const message = new Uint8Array([]);

    const result = encodeMessageLength(message);

    assert.strictEqual(result.length, MSG_LEN_PREFIX_BYTES);
    assert.strictEqual(result[0], 0); // length = 0
    assert.strictEqual(result[1], 0);
    assert.strictEqual(result[2], 0);
    assert.strictEqual(result[3], 0);
  });
});

describe("handleMessageFragmentation", () => {
  it("should handle complete message received at once", () => {
    const receivedMessages: Uint8Array[] = [];
    const handler = handleMessageFragmentation((data) => {
      receivedMessages.push(data);
    });

    const message = new Uint8Array([0x01, 0x02, 0x03]);
    const lengthPrefix = new Uint8Array([3, 0, 0, 0]); // length = 3 in little endian
    const completeFrame = new Uint8Array([...lengthPrefix, ...message]);

    handler(completeFrame);

    assert.strictEqual(receivedMessages.length, 1);
    assert.deepStrictEqual(receivedMessages[0], message);
  });

  it("should handle message received in fragments", () => {
    const receivedMessages: Uint8Array[] = [];
    const handler = handleMessageFragmentation((data) => {
      receivedMessages.push(data);
    });

    const message = new Uint8Array([0x01, 0x02, 0x03]);
    const lengthPrefix = new Uint8Array([3, 0, 0, 0]); // length = 3 in little endian

    // Send length prefix first
    handler(lengthPrefix.subarray(0, 2));
    assert.strictEqual(receivedMessages.length, 0);

    // Complete length prefix
    handler(lengthPrefix.subarray(2));
    assert.strictEqual(receivedMessages.length, 0);

    // Send partial message
    handler(message.subarray(0, 1));
    assert.strictEqual(receivedMessages.length, 0);

    // Complete message
    handler(message.subarray(1));
    assert.strictEqual(receivedMessages.length, 1);
    assert.deepStrictEqual(receivedMessages[0], message);
  });

  it("should handle multiple consecutive messages", () => {
    const receivedMessages: Uint8Array[] = [];
    const handler = handleMessageFragmentation((data) => {
      receivedMessages.push(data);
    });

    const message1 = new Uint8Array([0x01, 0x02]);
    const message2 = new Uint8Array([0x03, 0x04, 0x05]);
    const lengthPrefix1 = new Uint8Array([2, 0, 0, 0]); // length = 2
    const lengthPrefix2 = new Uint8Array([3, 0, 0, 0]); // length = 3
    const combinedFrame = new Uint8Array([
      ...lengthPrefix1, ...message1,
      ...lengthPrefix2, ...message2
    ]);

    handler(combinedFrame);

    assert.strictEqual(receivedMessages.length, 2);
    assert.deepStrictEqual(receivedMessages[0], message1);
    assert.deepStrictEqual(receivedMessages[1], message2);
  });
});
