import assert from "node:assert";
import { once } from "node:events";
import { after, before, describe, it } from "node:test";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { main } from "../main.js";
import { RpcClient } from "../src/client.js";
import type { RpcServer } from "../src/server.js";
import { JSON_RPC_VERSION } from "../src/types.js";

describe("JSON RPC Client-Server E2E", { concurrency: false }, () => {
  let client: RpcClient;
  let server: RpcServer;

  before(async () => {
    server = await main(["--config", `${import.meta.dirname}/e2e.config.json`]);
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
      { name: "Error", message: "Method not found: unknownMethod" },
    );
  });

  it("raises an error when more than necessary parameters are supplied", async () => {
    const bestBlock = await client.call("bestBlock");
    assert(Array.isArray(bestBlock));
    await assert.rejects(async () => await client.call("stateRoot", [bestBlock[0], 0]), {
      name: "Error",
      message: "Invalid params:\n[] Array must contain at most 1 element(s)",
    });
  });

  it("raises an error when a parameter of the wrong type is supplied", async () => {
    await assert.rejects(async () => await client.call("stateRoot", ["wrong argument"]), {
      name: "Error",
      message: "Invalid params:\n[0] Expected array, received string",
    });
  });

  it("raises an error when no parameters are supplied (even though necessary)", async () => {
    await assert.rejects(async () => await client.call("stateRoot"), {
      name: "Error",
      message: "Invalid params:\n[] Expected array, received null",
    });
  });

  it("raises an error when some (not all) parameters are missing", async () => {
    const bestBlock = await client.call("bestBlock");
    assert(Array.isArray(bestBlock));
    await assert.rejects(async () => await client.call("serviceData", [bestBlock[0]]), {
      name: "Error",
      message: "Invalid params:\n[] Array must contain at least 2 element(s)",
    });
  });

  it("raises an error when an unimplemented method is called", async () => {
    await assert.rejects(async () => await client.call("submitPreimage", ["asdf"]), {
      name: "Error",
      message: "Method not implemented",
    });
  });

  it("gets best block", async () => {
    const result = await client.call("bestBlock");
    assert.deepStrictEqual(result, [
      [
        27, 205, 76, 67, 50, 215, 111, 248, 191, 130, 156, 35, 94, 95, 149, 183, 75, 112, 167, 197, 106, 191, 38, 205,
        196, 131, 235, 118, 184, 109, 20, 12,
      ],
      100,
    ]);
  });

  it("gets finalized block", async () => {
    // todo [seko] we're temporarily returning the best instead of finalized block
    const result = await client.call("finalizedBlock");
    assert.deepStrictEqual(result, [
      [
        27, 205, 76, 67, 50, 215, 111, 248, 191, 130, 156, 35, 94, 95, 149, 183, 75, 112, 167, 197, 106, 191, 38, 205,
        196, 131, 235, 118, 184, 109, 20, 12,
      ],
      100,
    ]);
  });

  it("gets parent block", async () => {
    const bestBlock = await client.call("bestBlock");
    assert(Array.isArray(bestBlock));
    const result = await client.call("parent", [bestBlock[0]]);
    assert.deepStrictEqual(result, [
      [
        167, 227, 61, 178, 232, 8, 11, 252, 231, 179, 15, 187, 143, 145, 251, 155, 198, 98, 58, 176, 94, 115, 62, 215,
        124, 179, 39, 47, 18, 168, 230, 96,
      ],
      99,
    ]);
  });

  it("gets state root", async () => {
    const bestBlock = await client.call("bestBlock");
    assert(Array.isArray(bestBlock));
    const result = await client.call("stateRoot", [bestBlock[0]]);
    assert.deepStrictEqual(result, [
      [
        181, 215, 155, 230, 97, 89, 39, 179, 94, 250, 150, 113, 51, 30, 149, 97, 124, 93, 224, 129, 2, 219, 70, 133,
        160, 127, 241, 252, 233, 23, 46, 26,
      ],
    ]);
  });

  it("gets statistics", async () => {
    const bestBlock = await client.call("bestBlock");
    assert(Array.isArray(bestBlock));
    const result = await client.call("statistics", [bestBlock[0]]);
    assert(Array.isArray(result));
    const stats = BytesBlob.blobFromNumbers(result[0] as number[]);
    assert.deepStrictEqual(
      stats.toString(),
      "0x02000000000000000000000000000000030000000400000001000000000000000000000000000000040000000500000001000000000000000000000000000000030000000500000000000000000000000000000000000000030000000500000000000000000000000000000000000000040000000500000001000000000000000000000000000000040000000300000005000000000000000000000000000000040000000900000001000000000000000000000000000000020000000900000003000000000000000000000000000000040000000a00000000000000000000000000000000000000070000000b00000002000000000000000000000000000000060000000900000001000000000000000000000000000000060000000b000000000000000000000081a905000000008169c0fda50100000000000001c0fda50000000001c04ffb0000",
    );
  });

  it("gets service data", async () => {
    const bestBlock = await client.call("bestBlock");
    assert(Array.isArray(bestBlock));
    const result = await client.call("serviceData", [bestBlock[0], 0]);
    assert.deepStrictEqual(result, [
      [
        47, 70, 180, 238, 140, 80, 45, 11, 158, 102, 199, 136, 35, 180, 149, 158, 34, 193, 1, 217, 163, 209, 184, 37,
        84, 177, 145, 44, 193, 31, 110, 181, 255, 255, 255, 255, 255, 255, 255, 255, 10, 0, 0, 0, 0, 0, 0, 0, 10, 0, 0,
        0, 0, 0, 0, 0, 45, 122, 2, 0, 0, 0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 11, 0, 0, 0, 0, 0, 0, 0, 100,
        0, 0, 0, 0, 0, 0, 0,
      ],
    ]);
  });

  it("gets service value", async () => {
    const bestBlock = await client.call("bestBlock");
    assert(Array.isArray(bestBlock));
    const result = await client.call("serviceValue", [
      bestBlock[0],
      1,
      Array.from(Bytes.parseBytes("0x0242a295a93ac7f3ba564f0be83089a647a9bd3861798cf9fbffae0daa2ce1ff", HASH_SIZE).raw),
    ]);
    assert.deepStrictEqual(result, null);
  });

  const testPreimageHash = () =>
    Array.from(Bytes.parseBytes("0x2f46b4ee8c502d0b9e66c78823b4959e22c101d9a3d1b82554b1912cc11f6eb5", HASH_SIZE).raw);

  it("gets service preimage", async () => {
    const bestBlock = await client.call("bestBlock");
    assert(Array.isArray(bestBlock));
    const [data] = (await client.call("servicePreimage", [bestBlock[0], 0, testPreimageHash()])) as [number[]];
    assert.deepStrictEqual(data.length, 116356);
  });

  it("gets service request", async () => {
    const bestBlock = await client.call("bestBlock");
    assert(Array.isArray(bestBlock));
    const result = await client.call("serviceRequest", [bestBlock[0], 0, testPreimageHash(), 116356]);
    assert.deepStrictEqual(result, [[0]]);
  });

  it("lists services", async () => {
    const bestBlock = await client.call("bestBlock");
    assert(Array.isArray(bestBlock));
    const result = await client.call("listServices", [bestBlock[0]]);
    // TODO [ToDr] We should probably do a little bit better in terms of
    // tracking recently active services. Some options for the future:
    // 1. Use InMemoryDb for RPC E2E tests.
    // 2. Store additional service metadata in LMDB
    // 3. Cache the state object, so that accessed services would be returned here.
    assert.deepStrictEqual(result, [[]]);
  });

  it("subscribes and unsubscribes to/from service preimage", async (abort) => {
    const bestBlock = await client.call("bestBlock");
    assert(Array.isArray(bestBlock));

    const subscription = await client.subscribe("subscribeServicePreimage", [bestBlock[0], 0, testPreimageHash()]);

    try {
      const [data] = await once(subscription, "data", { signal: abort.signal });
      assert.deepStrictEqual(data[0].length, 116356);
    } finally {
      await subscription.unsubscribe();
    }
  });

  it("client handles errors when subscription is being requested", async () => {
    assert.rejects(async () =>
      client.subscribe("subscribeServicePreimage", [
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        0,
        [
          193, 99, 38, 67, 43, 91, 50, 19, 223, 209, 96, 148, 149, 225, 60, 107, 39, 108, 180, 116, 214, 121, 100, 83,
          55, 229, 194, 192, 159, 25, 181, 60, 61,
        ], // invalid preimage hash
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
