import assert from "node:assert";
import { describe, it } from "node:test";
import { parseArgs } from "./args.js";
import { createJamArgsConf } from "./index.js";

describe("Typeberry Common Interface (TCI): RPCConfig", () => {
  const defaultArgs = {
    port: "19800",
    nodeName: "test",
    config: "dev",
  };

  it("should crate rpc config", () => {
    const argv = parseArgs(["--port=9000"]);
    const { args, config: _config } = createJamArgsConf(argv);
    assert.deepStrictEqual(args, {
      ...defaultArgs,
      port: 9000,
    });
  });
});
