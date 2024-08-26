import assert from "node:assert";
import { type TestContext, describe, it } from "node:test";
import { MessageChannel } from "node:worker_threads";
import { TypedPort } from "./port";

function newChannel(t: TestContext) {
  const channel = new MessageChannel();
  t.after(() => {
    channel.port1.close();
    channel.port2.close();
  });
  return channel;
}

describe("TypedPort", () => {
  it("should send a signal", async (t) => {
    // given
    const channel = newChannel(t);
    const receiver = channel.port2;
    const port = new TypedPort(channel.port1);

    // when
    const response = new Promise((resolve) => {
      receiver.once("message", resolve);
    });
    port.sendSignal("myState", "signal1", { obj: true });

    // then
    assert.deepStrictEqual(await response, {
      data: { obj: true },
      id: 1,
      kind: "signal",
      name: "signal1",
      localState: "myState",
    });
  });

  it("should send a request", async (t) => {
    // given
    const channel = newChannel(t);
    const receiver = channel.port2;
    const port = new TypedPort(channel.port1);

    // when
    const response = new Promise((resolve) => {
      receiver.once("message", resolve);
    });
    port.sendRequest("myState", "signal1", { obj: true });

    // then
    assert.deepStrictEqual(await response, {
      data: { obj: true },
      id: 1,
      kind: "request",
      name: "signal1",
      localState: "myState",
    });
  });

  it("should receive a signal", async (t) => {
    // given
    const channel = newChannel(t);
    const port = new TypedPort(channel.port1);

    // when
    const response = new Promise((resolve) => {
      port.listeners.once("signal", (...args) => {
        resolve(args);
      });
    });

    channel.port2.postMessage({
      id: 10,
      kind: "signal",
      name: "signal3",
      data: { obj: false },
      localState: "otherState",
    });

    // then
    assert.deepStrictEqual(await response, [
      "signal3",
      { obj: false },
      "otherState",
      {
        data: { obj: false },
        id: 10,
        kind: "signal",
        name: "signal3",
        localState: "otherState",
      },
    ]);
  });
});
