import assert from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";
import { setTimeout } from "node:timers/promises";
import { MessageChannel } from "node:worker_threads";
import { codec } from "@typeberry/codec";
import { tinyChainSpec } from "@typeberry/config";
import { tryAsU32, type U32 } from "@typeberry/numbers";
import type { Envelope } from "@typeberry/workers-api";
import { ThreadPort } from "./port.js";

const spec = tinyChainSpec;

describe("ThreadPort", () => {
  let channel: MessageChannel;
  beforeEach(() => {
    channel = new MessageChannel();
  });

  afterEach(() => {
    channel.port1.close();
    channel.port2.close();
  });

  it("should successfuly send messages", async () => {
    const tx = new ThreadPort(spec, channel.port1);
    const rx = new ThreadPort(spec, channel.port2);

    let received: Envelope<U32> | null = null;
    // attach listener
    rx.on("hello", codec.varU32, (msg) => {
      received = msg;
    });
    assert.strictEqual(received, null);

    // send some message
    tx.postMessage("hello", codec.varU32, {
      responseId: "10",
      data: tryAsU32(42),
    });

    await setTimeout(5);

    assert.deepStrictEqual(received, {
      responseId: "10",
      data: tryAsU32(42),
    });
  });
});
