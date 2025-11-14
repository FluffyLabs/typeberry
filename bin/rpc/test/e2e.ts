import assert from "node:assert";
import { once } from "node:events";
import { after, before, describe, it } from "node:test";
import { main } from "../main.js";
import { RpcClient } from "../src/client.js";
import type { RpcServer } from "../src/server.js";
import { JSON_RPC_VERSION } from "../src/types.js";

// todo [seko] to be removed once validation and typing in client is implemented
type BlockDescriptor = {
  header_hash: string;
  slot: number;
};

describe("JSON RPC Client-Server E2E", { concurrency: false }, () => {
  let client: RpcClient;
  let server: RpcServer;

  before(async () => {
    server = await main([`--config=${import.meta.dirname}/e2e.config.json`]);
    client = new RpcClient("ws://localhost:19800");
    await client.waitForConnection();
  });

  after(async () => {
    client.close();
    await server.close();
  });

  it("raises an error for unknown method", async () => {
    await assert.rejects(
      async () => {
        await client.call("unknownMethod");
      },
      { code: -32601, message: "Method not found: unknownMethod" },
    );
  });

  it("raises an error when more than necessary parameters are supplied", async () => {
    const bestBlock = (await client.call("bestBlock")) as BlockDescriptor;
    await assert.rejects(async () => await client.call("stateRoot", [bestBlock.header_hash, 0]));
  });

  it("raises an error when a parameter of the wrong type is supplied", async () => {
    await assert.rejects(async () => await client.call("stateRoot", ["wrong argument"]));
  });

  it("raises an error when no parameters are supplied (even though necessary)", async () => {
    await assert.rejects(async () => await client.call("stateRoot"));
  });

  it("raises an error when some (not all) parameters are missing", async () => {
    const bestBlock = (await client.call("bestBlock")) as BlockDescriptor;
    await assert.rejects(async () => await client.call("serviceData", [bestBlock.header_hash]));
  });

  it("raises an error when an unimplemented method is called", async () => {
    await assert.rejects(async () => await client.call("submitPreimage", ["asdf"]));
  });

  it("raises an error when a non-base64 string is provided as hash", async () => {
    await assert.rejects(async () => await client.call("parent", ["ThisIsNotBase64!!"]), { code: -32602 });
  });

  it("gets best block", async () => {
    const result = (await client.call("bestBlock")) as BlockDescriptor;
    assert.deepStrictEqual(result, {
      header_hash: Buffer.from("1bcd4c4332d76ff8bf829c235e5f95b74b70a7c56abf26cdc483eb76b86d140c", "hex").toString(
        "base64",
      ),
      slot: 100,
    });
  });

  it("gets finalized block", async () => {
    // todo [seko] we're temporarily returning the best instead of finalized block
    const result = (await client.call("finalizedBlock")) as BlockDescriptor;
    assert.deepStrictEqual(result, {
      header_hash: Buffer.from("1bcd4c4332d76ff8bf829c235e5f95b74b70a7c56abf26cdc483eb76b86d140c", "hex").toString(
        "base64",
      ),
      slot: 100,
    });
  });

  it("gets parent block", async () => {
    const bestBlock = (await client.call("bestBlock")) as BlockDescriptor;
    const result = await client.call("parent", [bestBlock.header_hash]);
    assert.deepStrictEqual(result, {
      header_hash: Buffer.from("a7e33db2e8080bfce7b30fbb8f91fb9bc6623ab05e733ed77cb3272f12a8e660", "hex").toString(
        "base64",
      ),
      slot: 99,
    });
  });

  it("throws an error when a non-existing block hash is provided", async () => {
    await assert.rejects(
      async () => {
        await client.call("parent", [
          Buffer.from("1111111111111111111111111111111111111111111111111111111111111111", "hex").toString("base64"),
        ]);
      },
      {
        code: 1,
        message: "Block unavailable: 0x1111111111111111111111111111111111111111111111111111111111111111",
        data: "ERERERERERERERERERERERERERERERERERERERERERE=",
      },
    );
  });

  it("gets state root", async () => {
    const bestBlock = (await client.call("bestBlock")) as BlockDescriptor;
    const result = await client.call("stateRoot", [bestBlock.header_hash]);
    assert.deepStrictEqual(
      result,
      Buffer.from("b5d79be6615927b35efa9671331e95617c5de08102db4685a07ff1fce9172e1a", "hex").toString("base64"),
    );
  });

  it("gets statistics", async () => {
    const bestBlock = (await client.call("bestBlock")) as BlockDescriptor;
    const result = await client.call("statistics", [bestBlock.header_hash]);
    assert.deepStrictEqual(
      result,
      Buffer.from(
        "02000000000000000000000000000000030000000400000001000000000000000000000000000000040000000500000001000000000000000000000000000000030000000500000000000000000000000000000000000000030000000500000000000000000000000000000000000000040000000500000001000000000000000000000000000000040000000300000005000000000000000000000000000000040000000900000001000000000000000000000000000000020000000900000003000000000000000000000000000000040000000a00000000000000000000000000000000000000070000000b00000002000000000000000000000000000000060000000900000001000000000000000000000000000000060000000b000000000000000000000081a905000000008169c0fda50100000000000001c0fda50000000001c04ffb0000",
        "hex",
      ).toString("base64"),
    );
  });

  it("gets service data", async () => {
    const bestBlock = (await client.call("bestBlock")) as BlockDescriptor;
    const result = await client.call("serviceData", [bestBlock.header_hash, 0]);
    assert.deepStrictEqual(
      result,
      Buffer.from(
        "2f46b4ee8c502d0b9e66c78823b4959e22c101d9a3d1b82554b1912cc11f6eb5ffffffffffffffff0a000000000000000a000000000000002d7a020000000000ffffffffffffffff0b000000000000006400000000000000",
        "hex",
      ).toString("base64"),
    );
  });

  it("gets service value", async () => {
    const bestBlock = (await client.call("bestBlock")) as BlockDescriptor;
    const result = await client.call("serviceValue", [
      bestBlock.header_hash,
      1,
      Buffer.from("0242a295a93ac7f3ba564f0be83089a647a9bd3861798cf9fbffae0daa2ce1ff", "hex").toString("base64"),
    ]);
    assert.deepStrictEqual(result, null);
  });

  const testPreimageHash = Buffer.from(
    "2f46b4ee8c502d0b9e66c78823b4959e22c101d9a3d1b82554b1912cc11f6eb5",
    "hex",
  ).toString("base64");

  it("gets service preimage", async () => {
    const bestBlock = (await client.call("bestBlock")) as BlockDescriptor;
    const data = (await client.call("servicePreimage", [bestBlock.header_hash, 0, testPreimageHash])) as string;
    assert.deepStrictEqual(data.length, 155144);
  });

  it("gets service request", async () => {
    const bestBlock = (await client.call("bestBlock")) as BlockDescriptor;
    const result = await client.call("serviceRequest", [bestBlock.header_hash, 0, testPreimageHash, 116356]);
    assert.deepStrictEqual(result, [0]);
  });

  it("lists services", async () => {
    const bestBlock = (await client.call("bestBlock")) as BlockDescriptor;
    const result = await client.call("listServices", [bestBlock.header_hash]);
    // TODO [ToDr] We should probably do a little bit better in terms of
    // tracking recently active services. Some options for the future:
    // 1. Use InMemoryDb for RPC E2E tests.
    // 2. Store additional service metadata in LMDB
    // 3. Cache the state object, so that accessed services would be returned here.
    assert.deepStrictEqual(result, []);
  });

  it("subscribes and unsubscribes to/from service preimage", async (abort) => {
    const bestBlock = (await client.call("bestBlock")) as BlockDescriptor;
    const subscription = await client.subscribe("subscribeServicePreimage", [
      bestBlock.header_hash,
      0,
      testPreimageHash,
    ]);

    try {
      const [data] = (await once(subscription, "data", { signal: abort.signal })) as [string];
      assert.deepStrictEqual(data.length, 155144);
    } finally {
      await subscription.unsubscribe();
    }
  });

  it("client handles errors when subscription is being requested", async () => {
    assert.rejects(async () =>
      client.subscribe("subscribeServicePreimage", [
        Buffer.from("0000000000000000000000000000000000000000000000000000000000000000", "hex").toString("base64"),
        0,
        Buffer.from("c16326432b5b3213dfd1609495e13c6b276cb474d679645337e5c2c09f19b53c3d", "hex").toString("base64"), // invalid preimage hash
      ]),
    );
  });

  it("client handles errors produced by the subscription", async () => {
    const originalCallMethod = server.callMethod;
    server.callMethod = async (method: string, validatedParams: unknown) => {
      if (method === "bestBlock") {
        throw new Error("Forced error for bestBlock");
      }
      return originalCallMethod.call(server, method, validatedParams);
    };
    return new Promise<void>((resolve, reject) => {
      client.subscribe("subscribeBestBlock", []).then((subscription) => {
        subscription.on("data", async () => {
          await subscription.unsubscribe();
          reject(new Error("Subscription callback should not be called."));
        });
        subscription.on("error", async (error) => {
          assert.strictEqual(error, "Error: Forced error for bestBlock");
          await subscription.unsubscribe();
          resolve();
        });
      });
    }).finally(() => {
      server.callMethod = originalCallMethod;
    });
  });

  it("server gracefully handles malformed requests", async () => {
    const socket = client.getSocket();

    socket.send(JSON.stringify({ foo: "bar" }));

    const message = await new Promise<string>((resolve) => {
      socket.on("message", (data) => {
        resolve(data.toString());
      });
    });

    assert.deepStrictEqual(JSON.parse(message), {
      jsonrpc: "2.0",
      error: { code: -32600, message: 'Invalid request: {"foo":"bar"}' },
      id: null,
    });
  });

  it("server handles batch requests", async () => {
    const socket = client.getSocket();
    const bestBlock = await client.call("bestBlock");

    socket.send(
      JSON.stringify([
        { foo: "bar" }, // malformed request (error expected)
        {
          jsonrpc: JSON_RPC_VERSION,
          method: "notificationTest",
          params: [],
        }, // notification (no response expected, even if causes error)
        {
          jsonrpc: JSON_RPC_VERSION,
          method: "bestBlock",
          params: [],
          id: 1,
        }, // correct request
      ]),
    );

    const message = await new Promise<string>((resolve) => {
      socket.on("message", (data) => {
        resolve(data.toString());
      });
    });

    assert.deepStrictEqual(JSON.parse(message), [
      { jsonrpc: "2.0", error: { code: -32600, message: 'Invalid request: {"foo":"bar"}' }, id: null },
      {
        jsonrpc: "2.0",
        result: bestBlock,
        id: 1,
      },
    ]);
  });
});
