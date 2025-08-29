import assert from "node:assert";
import { after, before, describe, it } from "node:test";
import { main } from "../index.js";
import { RpcClient } from "../src/client.js";
import type { RpcServer } from "../src/server.js";
import { JSON_RPC_VERSION } from "../src/types.js";

describe("JSON RPC Client-Server E2E", () => {
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
    if (bestBlock !== null) {
      await assert.rejects(async () => await client.call("stateRoot", [bestBlock[0], 0]), {
        name: "Error",
        message: "Invalid params:\n[] Array must contain at most 1 element(s)",
      });
    }
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
    if (bestBlock !== null) {
      await assert.rejects(async () => await client.call("serviceData", [bestBlock[0]]), {
        name: "Error",
        message: "Invalid params:\n[] Array must contain at least 2 element(s)",
      });
    }
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
        77, 173, 166, 219, 49, 227, 93, 171, 173, 15, 27, 141, 178, 174, 165, 2, 46, 36, 135, 249, 95, 19, 17, 159, 175,
        180, 110, 108, 238, 202, 210, 176,
      ],
      100,
    ]);
  });

  it("gets finalized block", async () => {
    // todo [seko] we're temporarily returning the best instead of finalized block
    const result = await client.call("finalizedBlock");
    assert.deepStrictEqual(result, [
      [
        77, 173, 166, 219, 49, 227, 93, 171, 173, 15, 27, 141, 178, 174, 165, 2, 46, 36, 135, 249, 95, 19, 17, 159, 175,
        180, 110, 108, 238, 202, 210, 176,
      ],
      100,
    ]);
  });

  it("gets parent block", async () => {
    const bestBlock = await client.call("bestBlock");
    assert(Array.isArray(bestBlock));
    if (bestBlock !== null) {
      const result = await client.call("parent", [bestBlock[0]]);
      assert.deepStrictEqual(result, [
        [
          184, 54, 25, 235, 180, 192, 69, 64, 205, 171, 43, 13, 9, 155, 127, 155, 178, 144, 27, 211, 132, 139, 7, 47,
          73, 177, 21, 242, 5, 179, 30, 248,
        ],
        99,
      ]);
    }
  });

  it("gets state root", async () => {
    const bestBlock = await client.call("bestBlock");
    assert(Array.isArray(bestBlock));
    if (bestBlock !== null) {
      const result = await client.call("stateRoot", [bestBlock[0]]);
      assert.deepStrictEqual(result, [
        [
          126, 176, 204, 101, 185, 158, 144, 32, 149, 16, 50, 183, 6, 178, 150, 156, 190, 186, 228, 132, 59, 194, 182,
          183, 43, 93, 71, 210, 159, 249, 178, 232,
        ],
      ]);
    }
  });

  it("gets statistics", async () => {
    const bestBlock = await client.call("bestBlock");
    assert(Array.isArray(bestBlock));
    if (bestBlock !== null) {
      const result = await client.call("statistics", [bestBlock[0]]);
      assert.deepStrictEqual(result, [
        [
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0,
          6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0, 0,
        ],
      ]);
    }
  });

  it("gets service data", async () => {
    const bestBlock = await client.call("bestBlock");
    assert(Array.isArray(bestBlock));
    if (bestBlock !== null) {
      const result = await client.call("serviceData", [bestBlock[0], 0]);
      assert.deepStrictEqual(result, [
        [
          209, 248, 194, 173, 163, 8, 71, 253, 156, 57, 150, 53, 107, 15, 155, 43, 221, 236, 134, 68, 98, 181, 97, 179,
          97, 64, 76, 248, 205, 51, 117, 216, 255, 255, 255, 255, 255, 255, 255, 255, 10, 0, 0, 0, 0, 0, 0, 0, 10, 0, 0,
          0, 0, 0, 0, 0, 229, 117, 2, 0, 0, 0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 4, 0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0,
        ],
      ]);
    }
  });

  it("gets service value", async () => {
    const bestBlock = await client.call("bestBlock");
    assert(Array.isArray(bestBlock));
    if (bestBlock !== null) {
      const result = await client.call("serviceValue", [
        bestBlock[0],
        1,
        [
          188, 243, 43, 129, 172, 117, 15, 152, 11, 3, 200, 203, 219, 175, 90, 215, 217, 230, 170, 216, 35, 208, 153,
          226, 9, 215, 213, 160, 184, 47, 42, 237,
        ],
      ]);
      assert.deepStrictEqual(result, null);
    }
  });

  it("gets service preimage", async () => {
    const bestBlock = await client.call("bestBlock");
    assert(Array.isArray(bestBlock));
    if (bestBlock !== null) {
      const result = await client.call("servicePreimage", [
        bestBlock[0],
        0,
        [
          193, 99, 38, 67, 43, 91, 50, 19, 223, 209, 96, 148, 149, 225, 60, 107, 39, 108, 180, 116, 214, 121, 100, 83,
          55, 229, 194, 192, 159, 25, 181, 60,
        ],
      ]);
      assert.deepStrictEqual(result, [
        [
          9, 98, 111, 111, 116, 115, 116, 114, 97, 112, 0, 0, 0, 0, 0, 0, 0, 0, 0, 32, 0, 10, 0, 0, 0, 0, 0, 6, 40, 2,
          51, 7, 50, 0, 21,
        ],
      ]);
    }
  });

  it("gets service request", async () => {
    const bestBlock = await client.call("bestBlock");
    assert(Array.isArray(bestBlock));
    if (bestBlock !== null) {
      const result = await client.call("serviceRequest", [
        bestBlock[0],
        0,
        [
          193, 99, 38, 67, 43, 91, 50, 19, 223, 209, 96, 148, 149, 225, 60, 107, 39, 108, 180, 116, 214, 121, 100, 83,
          55, 229, 194, 192, 159, 25, 181, 60,
        ],
        35,
      ]);
      assert.deepStrictEqual(result, [[0]]);
    }
  });

  it("lists services", async () => {
    const bestBlock = await client.call("bestBlock");
    assert(Array.isArray(bestBlock));
    if (bestBlock !== null) {
      const result = await client.call("listServices", [bestBlock[0]]);
      // TODO [ToDr] We should probably do a little bit better in terms of
      // tracking recently active services. Some options for the future:
      // 1. Use InMemoryDb for RPC E2E tests.
      // 2. Store additional service metadata in LMDB
      // 3. Cache the state object, so that accessed services would be returned here.
      assert.deepStrictEqual(result, [[]]);
    }
  });

  it("subscribes and unsubscribes to/from service preimage", async () => {
    const bestBlock = await client.call("bestBlock");
    assert(Array.isArray(bestBlock));
    if (bestBlock !== null) {
      return new Promise<void>((resolve, reject) => {
        client
          .subscribe("subscribeServicePreimage", [
            bestBlock[0],
            0,
            [
              193, 99, 38, 67, 43, 91, 50, 19, 223, 209, 96, 148, 149, 225, 60, 107, 39, 108, 180, 116, 214, 121, 100,
              83, 55, 229, 194, 192, 159, 25, 181, 60,
            ],
          ])
          .then((subscription) => {
            subscription.on("data", async (data) => {
              try {
                assert.deepStrictEqual(data, [
                  [
                    9, 98, 111, 111, 116, 115, 116, 114, 97, 112, 0, 0, 0, 0, 0, 0, 0, 0, 0, 32, 0, 10, 0, 0, 0, 0, 0,
                    6, 40, 2, 51, 7, 50, 0, 21,
                  ],
                ]);

                resolve();
              } catch (e) {
                reject(e);
              } finally {
                await subscription.unsubscribe();
              }
            });
          });
      });
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
