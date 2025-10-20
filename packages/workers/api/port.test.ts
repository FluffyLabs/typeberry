import assert from "node:assert";
import { describe, it } from "node:test";
import { codec } from "@typeberry/codec";
import { tryAsU32, type U32 } from "@typeberry/numbers";
import { DirectPort, type Envelope } from "./port.js";

describe("DirectPort", () => {
  it("should communicate over direct port", () => {
    const [txPort, rxPort] = DirectPort.pair();
    let receivedMessage: Envelope<U32> | null = null;
    rxPort.on("hello", codec.u32, (msg) => {
      receivedMessage = msg;
    });
    assert.deepStrictEqual(receivedMessage, null);

    txPort.postMessage("nothello", codec.nothing, {
      responseId: "10",
      data: undefined,
    });
    assert.deepStrictEqual(receivedMessage, null);

    txPort.postMessage("hello", codec.u32, {
      responseId: "10",
      data: tryAsU32(10),
    });

    assert.deepStrictEqual(receivedMessage, {
      responseId: "10",
      data: tryAsU32(10),
    });
  });
});
