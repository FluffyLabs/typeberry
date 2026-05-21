import assert from "node:assert";
import { describe, it } from "node:test";
import { MessageChannel } from "node:worker_threads";
import { codec } from "@typeberry/codec";
import { tinyChainSpec } from "@typeberry/config";
import { Blake2b } from "@typeberry/hash";
import { tryAsU32 } from "@typeberry/numbers";
import { configTransferList, LmdbWorkerConfig } from "./config.js";
import { ThreadPort } from "./port.js";

const spec = tinyChainSpec;

describe("LmdbWorkerConfig transfer list", () => {
  it("surfaces embedded worker ports so they can be transferred", async () => {
    const blake2b = await Blake2b.createHasher();
    const [portA, portB] = ThreadPort.pair(spec);
    const config = LmdbWorkerConfig.new({
      nodeName: "node",
      chainSpec: spec,
      workerParams: tryAsU32(7),
      dbPath: "db",
      blake2b,
      ports: new Map([["authorship-network", portA]]),
    });

    const transferable = config.intoTransferable(codec.varU32);
    const transferList = configTransferList(transferable);

    // the single embedded comms port must be reported for transfer
    assert.strictEqual(transferList.length, 1);

    const sink = new MessageChannel();
    try {
      // reproduces the bug: a config carrying a port cannot be cloned without
      // listing that port in the transfer list.
      assert.throws(() => sink.port1.postMessage(transferable, []), /transfer/i);
      // with the ports surfaced, posting succeeds.
      assert.doesNotThrow(() => sink.port1.postMessage(transferable, transferList));
    } finally {
      sink.port1.close();
      sink.port2.close();
      portB.close();
    }
  });
});
