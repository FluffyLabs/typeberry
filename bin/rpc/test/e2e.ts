import assert from "node:assert";
import { once } from "node:events";
import { after, before, describe, it } from "node:test";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { main } from "../index.js";
import { RpcClient } from "../src/client.js";
import type { RpcServer } from "../src/server.js";
import { JSON_RPC_VERSION } from "../src/types.js";

describe("JSON RPC Client-Server E2E", { concurrency: false }, () => {
  let client: RpcClient;
  let server: RpcServer;

  before(async () => {
    server = main(["--config", `${import.meta.dirname}/e2e.config.json`]);
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
        66, 194, 80, 245, 60, 36, 98, 48, 128, 121, 86, 15, 205, 100, 219, 56, 13, 150, 95, 36, 84, 240, 237, 247, 53,
        26, 248, 213, 42, 160, 196, 175,
      ],
      100,
    ]);
  });

  it("gets finalized block", async () => {
    // todo [seko] we're temporarily returning the best instead of finalized block
    const result = await client.call("finalizedBlock");
    assert.deepStrictEqual(result, [
      [
        66, 194, 80, 245, 60, 36, 98, 48, 128, 121, 86, 15, 205, 100, 219, 56, 13, 150, 95, 36, 84, 240, 237, 247, 53,
        26, 248, 213, 42, 160, 196, 175,
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
        159, 166, 42, 25, 26, 110, 58, 161, 135, 35, 22, 226, 246, 110, 143, 51, 78, 118, 231, 78, 58, 182, 97, 51, 26,
        227, 218, 85, 88, 198, 182, 112,
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
        16, 112, 132, 190, 44, 222, 130, 94, 241, 239, 224, 184, 68, 197, 145, 224, 187, 78, 199, 118, 34, 37, 53, 112,
        249, 148, 166, 40, 119, 125, 191, 174,
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
      "0x0100000000000000000000000000000001000000010000000100000000000000020000003d00000002000000010000000200000000000000000000000000000002000000010000000100000000000000010000006200000002000000010000000000000000000000000000000000000001000000010000000000000000000000000000000000000001000000010000000300000000000000040000009300000006000000060000000100000000000000050000003301000006000000060000000200000000000000000000000000000006000000060000000100000000000000020000005500000006000000060000000300000000000000030000008b00000006000000060000000200000000000000020000005a00000006000000060000000000000000008234c0fc7d00000000000000000100000000016204c0fc7d0000000000000000",
    );
  });

  it("gets service data", async () => {
    const bestBlock = await client.call("bestBlock");
    assert(Array.isArray(bestBlock));
    const result = await client.call("serviceData", [bestBlock[0], 0]);
    assert.deepStrictEqual(result, [
      [
        2, 66, 162, 149, 169, 58, 199, 243, 186, 86, 79, 11, 232, 48, 137, 166, 71, 169, 189, 56, 97, 121, 140, 249,
        251, 255, 174, 13, 170, 44, 225, 255, 255, 255, 255, 255, 255, 255, 255, 255, 10, 0, 0, 0, 0, 0, 0, 0, 10, 0, 0,
        0, 0, 0, 0, 0, 0, 139, 2, 0, 0, 0, 0, 0, 124, 0, 0, 0,
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
    Array.from(Bytes.parseBytes("0x79062971f191d944d07dac7afb6e4425dc3632567f94915e47c04f88f0b25851", HASH_SIZE).raw);

  it("gets service preimage", async () => {
    const bestBlock = await client.call("bestBlock");
    assert(Array.isArray(bestBlock));
    const result = await client.call("servicePreimage", [bestBlock[0], 0, testPreimageHash()]);
    assert.deepStrictEqual(result, [[178, 83, 93, 171, 200, 230, 45, 217, 31, 223, 139, 19, 107, 149, 165, 229]]);
  });

  it("gets service request", async () => {
    const bestBlock = await client.call("bestBlock");
    assert(Array.isArray(bestBlock));
    const result = await client.call("serviceRequest", [bestBlock[0], 0, testPreimageHash(), 16]);
    assert.deepStrictEqual(result, [[78]]);
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
      assert.deepStrictEqual(data, [[178, 83, 93, 171, 200, 230, 45, 217, 31, 223, 139, 19, 107, 149, 165, 229]]);
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
