import assert from "node:assert";
import { describe, it } from "node:test";
import { parseArgs } from "./args.js";
import { rpcConfig } from "./index.js";

describe("Typeberry Common Interface (TCI): RPCConfig", () => {
  const defaultArgs = {
    port: "19800",
    nodeName: "test",
    config: "dev",
  };

  it("should crate rpc config", () => {
    const argv = parseArgs(["--port=9000"]);
    const rpcArgs = rpcConfig(argv);
    assert.deepStrictEqual(rpcArgs, {
      ...defaultArgs,
      port: 9000,
    });
  });
});
