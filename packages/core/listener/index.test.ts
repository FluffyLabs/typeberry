import assert from "node:assert";
import { describe, it } from "node:test";
import { Listener } from "./index.js";

describe("Listener", () => {
  it("supports persistent, one-shot, done, and removed listeners", () => {
    const event = new Listener<number>();
    const values: number[] = [];
    const persistent = (value: number) => values.push(value);
    let done = false;

    event.on(persistent);
    event.once((value) => values.push(value * 10));
    event.onceDone(() => {
      done = true;
    });

    event.emit(1);
    event.off(persistent);
    event.emit(2);
    event.on((value) => values.push(value * 100));
    event.markDone();
    event.emit(3);

    assert.deepStrictEqual(values, [1, 10]);
    assert.strictEqual(done, true);
  });

  it("applies subscription changes on the next emission", () => {
    const event = new Listener<number>();
    const values: string[] = [];
    const lateListener = (value: number) => values.push(`late:${value}`);
    const secondListener = (value: number) => values.push(`second:${value}`);

    event.on((value) => {
      values.push(`first:${value}`);
      event.off(secondListener);
      event.on(lateListener);
    });
    event.on(secondListener);

    event.emit(1);
    event.emit(2);

    assert.deepStrictEqual(values, ["first:1", "second:1", "first:2", "late:2"]);
  });

  it("defers callback handlers until after their response", async () => {
    const event = new Listener<number>();
    let received: number | null = null;
    event.on((value) => {
      received = value;
    });

    await event.callbackHandler()(1);
    assert.strictEqual(received, null);

    await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
    assert.strictEqual(received, 1);
  });
});
