import assert from "node:assert";
import { describe, it } from "node:test";
import { DEFAULTS, type SharedOptions } from "@typeberry/jam";
import { parseArgs } from "./args.js";
import { createJamArgsConf } from "./index.js";

describe("Typeberry Common Interface (TCI): RPCConfig", () => {
  const defaultOptions: SharedOptions = {
    nodeName: DEFAULTS.name,
    configPath: DEFAULTS.config,
  };

  it("should crate rpc config", () => {
    const argv = parseArgs(["--metadata=Bob"]);
    const { args, config: _config } = createJamArgsConf(argv);
    assert.deepStrictEqual(args.args, {
      ...defaultOptions,
      nodeName: "Bob",
    });
  });
});
