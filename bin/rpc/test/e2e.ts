import assert from "node:assert";
import { after, before, describe, it } from "node:test";
import { RpcClient } from "@typeberry/rpc-client";
import { JSON_RPC_VERSION, validation } from "@typeberry/rpc-validation";
import { main } from "../main.js";
import type { RpcServer } from "../src/server.js";

function hexToUint8Array(hex: string): Uint8Array {
  return new Uint8Array(Buffer.from(hex, "hex"));
}

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

  it("gets best block", async () => {
    const result = await client.call("bestBlock");
    assert.deepStrictEqual(result, {
      header_hash: hexToUint8Array("1bcd4c4332d76ff8bf829c235e5f95b74b70a7c56abf26cdc483eb76b86d140c"),
      slot: 100,
    });
  });

  it("gets finalized block", async () => {
    // todo [seko] we're temporarily returning the best instead of finalized block
    const result = await client.call("finalizedBlock");
    assert.deepStrictEqual(result, {
      header_hash: hexToUint8Array("1bcd4c4332d76ff8bf829c235e5f95b74b70a7c56abf26cdc483eb76b86d140c"),
      slot: 100,
    });
  });

  it("gets parent block", async () => {
    const bestBlock = await client.call("bestBlock");
    const result = await client.call("parent", [bestBlock.header_hash]);
    assert.deepStrictEqual(result, {
      header_hash: hexToUint8Array("a7e33db2e8080bfce7b30fbb8f91fb9bc6623ab05e733ed77cb3272f12a8e660"),
      slot: 99,
    });
  });

  it("throws an error when a non-existing block hash is provided", async () => {
    await assert.rejects(
      async () => {
        await client.call("parent", [
          hexToUint8Array("1111111111111111111111111111111111111111111111111111111111111111"),
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
    const bestBlock = await client.call("bestBlock");
    const result = await client.call("stateRoot", [bestBlock.header_hash]);
    assert.deepStrictEqual(result, hexToUint8Array("b5d79be6615927b35efa9671331e95617c5de08102db4685a07ff1fce9172e1a"));
  });

  it("gets statistics", async () => {
    const bestBlock = await client.call("bestBlock");
    const result = await client.call("statistics", [bestBlock.header_hash]);
    assert.deepStrictEqual(
      result,
      hexToUint8Array(
        "02000000000000000000000000000000030000000400000001000000000000000000000000000000040000000500000001000000000000000000000000000000030000000500000000000000000000000000000000000000030000000500000000000000000000000000000000000000040000000500000001000000000000000000000000000000040000000300000005000000000000000000000000000000040000000900000001000000000000000000000000000000020000000900000003000000000000000000000000000000040000000a00000000000000000000000000000000000000070000000b00000002000000000000000000000000000000060000000900000001000000000000000000000000000000060000000b000000000000000000000081a905000000008169c0fda50100000000000001c0fda50000000001c04ffb0000",
      ),
    );
  });

  it("gets service data", async () => {
    const bestBlock = await client.call("bestBlock");
    const result = await client.call("serviceData", [bestBlock.header_hash, 0]);
    assert.deepStrictEqual(
      result,
      hexToUint8Array(
        "2f46b4ee8c502d0b9e66c78823b4959e22c101d9a3d1b82554b1912cc11f6eb5ffffffffffffffff0a000000000000000a000000000000002d7a020000000000ffffffffffffffff0b000000000000006400000000000000",
      ),
    );
  });

  it("gets service value", async () => {
    const bestBlock = await client.call("bestBlock");
    const result = await client.call("serviceValue", [
      bestBlock.header_hash,
      1,
      hexToUint8Array("0242a295a93ac7f3ba564f0be83089a647a9bd3861798cf9fbffae0daa2ce1ff"),
    ]);
    assert.deepStrictEqual(result, null);
  });

  const testPreimageHash = hexToUint8Array("2f46b4ee8c502d0b9e66c78823b4959e22c101d9a3d1b82554b1912cc11f6eb5");

  it("gets service preimage", async () => {
    const bestBlock = await client.call("bestBlock");
    const data = await client.call("servicePreimage", [bestBlock.header_hash, 0, testPreimageHash]);
    assert.deepStrictEqual(data?.length, 116356);
  });

  it("gets service request", async () => {
    const bestBlock = await client.call("bestBlock");
    const result = await client.call("serviceRequest", [bestBlock.header_hash, 0, testPreimageHash, 116356]);
    assert.deepStrictEqual(result, [0]);
  });

  it("lists services", async () => {
    const bestBlock = await client.call("bestBlock");
    const result = await client.call("listServices", [bestBlock.header_hash]);
    // TODO [ToDr] We should probably do a little bit better in terms of
    // tracking recently active services. Some options for the future:
    // 1. Use InMemoryDb for RPC E2E tests.
    // 2. Store additional service metadata in LMDB
    // 3. Cache the state object, so that accessed services would be returned here.
    assert.deepStrictEqual(result, []);
  });

  it("subscribes and unsubscribes to/from service preimage", async () => {
    const subscription = await client.subscribe("subscribeServicePreimage", [0, testPreimageHash, false]);

    try {
      const data = await new Promise<string>((resolve) =>
        subscription.once("data", (result) => resolve(result as string)),
      );
      assert.deepStrictEqual(data.length, 155144);
    } finally {
      await subscription.unsubscribe();
    }
  });

  it("client handles errors when subscription is being requested", async () => {
    assert.rejects(async () =>
      client.subscribe("subscribeServicePreimage", [
        0,
        hexToUint8Array("c16326432b5b3213dfd1609495e13c6b276cb474d679645337e5c2c09f19b53c3d"), // invalid preimage hash
        false,
      ]),
    );
  });

  it("client handles errors produced by the subscription", async () => {
    const handlers = server.getHandlers();
    const originalHandler = handlers.subscribeBestBlock;
    handlers.subscribeBestBlock = async (params, { subscription }) => {
      return subscription.subscribe(
        "subscribeBestBlock",
        () => {
          throw new Error("Forced error for bestBlock");
        },
        validation.schemas.bestBlock.output,
        params,
      );
    };
    after(() => {
      handlers.subscribeBestBlock = originalHandler;
    });
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
    });
  });

  it("server raises an error for unknown method", async () => {
    const socket = client.getSocket();

    socket.send(
      JSON.stringify({
        jsonrpc: JSON_RPC_VERSION,
        method: "unknownMethod",
        params: [],
        id: 1,
      }),
    );

    const message = await new Promise<string>((resolve) => {
      socket.on("message", (data) => {
        resolve(data.toString());
      });
    });

    assert.deepStrictEqual(JSON.parse(message), {
      jsonrpc: "2.0",
      error: { code: -32601, message: "Method not found: unknownMethod" },
      id: 1,
    });
  });

  it("server raises an error when more than necessary parameters are supplied", async () => {
    const bestBlock = await client.call("bestBlock");
    const socket = client.getSocket();

    socket.send(
      JSON.stringify({
        jsonrpc: JSON_RPC_VERSION,
        method: "stateRoot",
        params: [Buffer.from(bestBlock.header_hash).toString("base64"), 0],
        id: 1,
      }),
    );

    const message = await new Promise<string>((resolve) => {
      socket.on("message", (data) => {
        resolve(data.toString());
      });
    });

    assert.deepStrictEqual(JSON.parse(message), {
      jsonrpc: "2.0",
      error: { code: -32602, message: "Invalid params:\n[] Too big: expected array to have <1 items" },
      id: 1,
    });
  });

  it("server raises an error when a parameter of the wrong type is supplied", async () => {
    const bestBlock = await client.call("bestBlock");
    const socket = client.getSocket();

    socket.send(
      JSON.stringify({
        jsonrpc: JSON_RPC_VERSION,
        method: "serviceData",
        params: [Buffer.from(bestBlock.header_hash).toString("base64"), "wrong argument"],
        id: 1,
      }),
    );

    const message = await new Promise<string>((resolve) => {
      socket.on("message", (data) => {
        resolve(data.toString());
      });
    });

    assert.deepStrictEqual(JSON.parse(message), {
      jsonrpc: "2.0",
      error: { code: -32602, message: "Invalid params:\n[1] Invalid input: expected number, received string" },
      id: 1,
    });
  });

  it("server raises an error when no parameters are supplied (even though necessary)", async () => {
    const socket = client.getSocket();

    socket.send(
      JSON.stringify({
        jsonrpc: JSON_RPC_VERSION,
        method: "stateRoot",
        id: 1,
      }),
    );

    const message = await new Promise<string>((resolve) => {
      socket.on("message", (data) => {
        resolve(data.toString());
      });
    });

    assert.deepStrictEqual(JSON.parse(message), {
      jsonrpc: "2.0",
      error: { code: -32602, message: "Invalid params:\n[0] Invalid input: expected string, received undefined" },
      id: 1,
    });
  });

  it("server raises an error when some (not all) parameters are missing", async () => {
    const bestBlock = await client.call("bestBlock");
    const socket = client.getSocket();

    socket.send(
      JSON.stringify({
        jsonrpc: JSON_RPC_VERSION,
        method: "serviceData",
        params: [Buffer.from(bestBlock.header_hash).toString("base64")],
        id: 1,
      }),
    );

    const message = await new Promise<string>((resolve) => {
      socket.on("message", (data) => {
        resolve(data.toString());
      });
    });

    assert.deepStrictEqual(JSON.parse(message), {
      jsonrpc: "2.0",
      error: { code: -32602, message: "Invalid params:\n[1] Invalid input: expected number, received undefined" },
      id: 1,
    });
  });

  it("server raises an error when an unimplemented method is called", async () => {
    const socket = client.getSocket();

    socket.send(
      JSON.stringify({
        jsonrpc: JSON_RPC_VERSION,
        method: "submitPreimage",
        params: [],
        id: 1,
      }),
    );

    const message = await new Promise<string>((resolve) => {
      socket.on("message", (data) => {
        resolve(data.toString());
      });
    });

    assert.deepStrictEqual(JSON.parse(message), {
      jsonrpc: "2.0",
      error: { code: 0, message: "Method not implemented" },
      id: 1,
    });
  });

  it("server raises an error when a non-base64 string is provided as hash", async () => {
    const socket = client.getSocket();

    socket.send(
      JSON.stringify({
        jsonrpc: JSON_RPC_VERSION,
        method: "parent",
        params: ["ThisIsNotBase64!!"],
        id: 1,
      }),
    );

    const message = await new Promise<string>((resolve) => {
      socket.on("message", (data) => {
        resolve(data.toString());
      });
    });

    assert.deepStrictEqual(JSON.parse(message), {
      jsonrpc: "2.0",
      error: { code: -32602, message: "Invalid params:\n[0] Invalid base64-encoded string" },
      id: 1,
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
        result: {
          ...bestBlock,
          header_hash: Buffer.from(bestBlock.header_hash).toString("base64"),
        },
        id: 1,
      },
    ]);
  });
});
