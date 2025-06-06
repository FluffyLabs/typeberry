import assert from "node:assert";
import { after, before, describe, it } from "node:test";
import { RpcClient } from "../src/client";

// todo [seko] these tests need to be updated to work with some predefined
// and universally obtainable database. They currently only work with my local db.

describe("RPC Client", () => {
  let client: RpcClient;

  before(async () => {
    client = new RpcClient("ws://localhost:19800");
    await client.waitForConnection();
  });

  after(() => {
    client.close();
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
        12, 95, 248, 111, 192, 152, 121, 255, 135, 60, 249, 94, 53, 73, 255, 43, 14, 191, 16, 4, 181, 83, 209, 254, 68,
        215, 107, 225, 91, 29, 97, 40,
      ],
      0,
    ]);
  });

  it("gets finalized block", async () => {
    // todo [seko] we're temporarily returning the best instead of finalized block
    const result = await client.call("finalizedBlock");
    assert.deepStrictEqual(result, [
      [
        12, 95, 248, 111, 192, 152, 121, 255, 135, 60, 249, 94, 53, 73, 255, 43, 14, 191, 16, 4, 181, 83, 209, 254, 68,
        215, 107, 225, 91, 29, 97, 40,
      ],
      0,
    ]);
  });

  it("gets parent block", async () => {
    const bestBlock = await client.call("bestBlock");
    assert(Array.isArray(bestBlock));
    if (bestBlock !== null) {
      const result = await client.call("parent", [bestBlock[0]]);
      assert.deepStrictEqual(result, null);
      // todo [seko] need to come up with a test database that has more than one block
    }
  });

  it("gets state root", async () => {
    const bestBlock = await client.call("bestBlock");
    assert(Array.isArray(bestBlock));
    if (bestBlock !== null) {
      const result = await client.call("stateRoot", [bestBlock[0]]);
      assert.deepStrictEqual(result, [
        [
          188, 243, 43, 129, 172, 117, 15, 152, 11, 3, 200, 203, 219, 175, 90, 215, 217, 230, 170, 216, 35, 208, 153,
          226, 9, 215, 213, 160, 184, 47, 42, 237,
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
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
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
          21, 248, 72, 94, 58, 136, 232, 97, 130, 230, 50, 128, 114, 13, 94, 201, 137, 37, 120, 240, 229, 119, 251, 27,
          205, 218, 92, 244, 151, 149, 8, 21, 0, 228, 11, 84, 2, 0, 0, 0, 100, 0, 0, 0, 0, 0, 0, 0, 100, 0, 0, 0, 0, 0,
          0, 0, 16, 5, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0,
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
      assert.deepStrictEqual(result, [[0]]);
    }
  });

  it("subscribes and unsubscribes to/from service preimage", async () => {
    const bestBlock = await client.call("bestBlock");
    assert(Array.isArray(bestBlock));
    if (bestBlock !== null) {
      const subscribeResult = await client.call("subscribeServicePreimage", [
        bestBlock[0],
        0,
        [
          193, 99, 38, 67, 43, 91, 50, 19, 223, 209, 96, 148, 149, 225, 60, 107, 39, 108, 180, 116, 214, 121, 100, 83,
          55, 229, 194, 192, 159, 25, 181, 60,
        ],
      ]);
      assert(Array.isArray(subscribeResult));
      assert.match(subscribeResult[0], /0x[0-9A-Fa-f]+/);

      if (subscribeResult !== null) {
        const unsubscribeResult = await client.call("unsubscribeServicePreimage", [subscribeResult[0]]);
        assert.notStrictEqual(unsubscribeResult, null);
      }
    }

    // todo [seko] implement tests for presence of subscription messages
    // (requires implementing a subscription interface in the client)
  });
});
