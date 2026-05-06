import assert from "node:assert";
import { describe, it } from "node:test";
import { KnownChainSpec, NODE_DEFAULTS } from "@typeberry/config-node";
import { Level } from "@typeberry/logger";
import { Command } from "./args.js";
import {
  JAM_FUZZ,
  JAM_FUZZ_DATA_PATH,
  JAM_FUZZ_LOG_LEVEL,
  JAM_FUZZ_SOCK_PATH,
  JAM_FUZZ_SPEC,
  readFuzzEnv,
  synthesizeFuzzArgs,
} from "./fuzz-env.js";

describe("readFuzzEnv", () => {
  it("returns null when JAM_FUZZ is unset", () => {
    assert.strictEqual(readFuzzEnv({}), null);
  });

  it("returns null when JAM_FUZZ is empty string", () => {
    assert.strictEqual(readFuzzEnv({ [JAM_FUZZ]: "" }), null);
  });

  it("parses tiny spec happy path", () => {
    const result = readFuzzEnv({
      [JAM_FUZZ]: "1",
      [JAM_FUZZ_SPEC]: "tiny",
      [JAM_FUZZ_SOCK_PATH]: "/tmp/jam.sock",
      [JAM_FUZZ_DATA_PATH]: "/tmp/jam-data",
    });

    assert.deepStrictEqual(result, {
      spec: KnownChainSpec.Tiny,
      socketPath: "/tmp/jam.sock",
      dataPath: "/tmp/jam-data",
      logLevel: null,
    });
  });

  it("parses full spec happy path", () => {
    const result = readFuzzEnv({
      [JAM_FUZZ]: "1",
      [JAM_FUZZ_SPEC]: "full",
      [JAM_FUZZ_SOCK_PATH]: "/tmp/jam.sock",
      [JAM_FUZZ_DATA_PATH]: "/tmp/jam-data",
    });

    assert.strictEqual(result?.spec, KnownChainSpec.Full);
  });

  it("rejects missing JAM_FUZZ_SPEC", () => {
    assert.throws(
      () =>
        readFuzzEnv({
          [JAM_FUZZ]: "1",
          [JAM_FUZZ_SOCK_PATH]: "/tmp/s",
          [JAM_FUZZ_DATA_PATH]: "/tmp/d",
        }),
      new RegExp(`${JAM_FUZZ_SPEC} is required`),
    );
  });

  it("rejects missing JAM_FUZZ_SOCK_PATH", () => {
    assert.throws(
      () =>
        readFuzzEnv({
          [JAM_FUZZ]: "1",
          [JAM_FUZZ_SPEC]: "tiny",
          [JAM_FUZZ_DATA_PATH]: "/tmp/d",
        }),
      new RegExp(`${JAM_FUZZ_SOCK_PATH} is required`),
    );
  });

  it("rejects missing JAM_FUZZ_DATA_PATH", () => {
    assert.throws(
      () =>
        readFuzzEnv({
          [JAM_FUZZ]: "1",
          [JAM_FUZZ_SPEC]: "tiny",
          [JAM_FUZZ_SOCK_PATH]: "/tmp/s",
        }),
      new RegExp(`${JAM_FUZZ_DATA_PATH} is required`),
    );
  });

  it("rejects empty JAM_FUZZ_SOCK_PATH", () => {
    assert.throws(
      () =>
        readFuzzEnv({
          [JAM_FUZZ]: "1",
          [JAM_FUZZ_SPEC]: "tiny",
          [JAM_FUZZ_SOCK_PATH]: "",
          [JAM_FUZZ_DATA_PATH]: "/tmp/d",
        }),
      new RegExp(`${JAM_FUZZ_SOCK_PATH} is required`),
    );
  });

  it("rejects bogus JAM_FUZZ_SPEC", () => {
    assert.throws(
      () =>
        readFuzzEnv({
          [JAM_FUZZ]: "1",
          [JAM_FUZZ_SPEC]: "huge",
          [JAM_FUZZ_SOCK_PATH]: "/tmp/s",
          [JAM_FUZZ_DATA_PATH]: "/tmp/d",
        }),
      new RegExp(`${JAM_FUZZ_SPEC} must be one of: tiny, full`),
    );
  });

  it("parses JAM_FUZZ_LOG_LEVEL=debug as Level.LOG", () => {
    const result = readFuzzEnv({
      [JAM_FUZZ]: "1",
      [JAM_FUZZ_SPEC]: "tiny",
      [JAM_FUZZ_SOCK_PATH]: "/tmp/s",
      [JAM_FUZZ_DATA_PATH]: "/tmp/d",
      [JAM_FUZZ_LOG_LEVEL]: "debug",
    });
    assert.strictEqual(result?.logLevel, Level.LOG);
  });

  it("parses JAM_FUZZ_LOG_LEVEL=TRACE case-insensitively", () => {
    const result = readFuzzEnv({
      [JAM_FUZZ]: "1",
      [JAM_FUZZ_SPEC]: "tiny",
      [JAM_FUZZ_SOCK_PATH]: "/tmp/s",
      [JAM_FUZZ_DATA_PATH]: "/tmp/d",
      [JAM_FUZZ_LOG_LEVEL]: "TRACE",
    });
    assert.strictEqual(result?.logLevel, Level.TRACE);
  });

  it("parses each documented log level", () => {
    const cases: [string, Level][] = [
      ["error", Level.ERROR],
      ["warn", Level.WARN],
      ["info", Level.INFO],
      ["debug", Level.LOG],
      ["trace", Level.TRACE],
    ];
    for (const [raw, expected] of cases) {
      const result = readFuzzEnv({
        [JAM_FUZZ]: "1",
        [JAM_FUZZ_SPEC]: "tiny",
        [JAM_FUZZ_SOCK_PATH]: "/tmp/s",
        [JAM_FUZZ_DATA_PATH]: "/tmp/d",
        [JAM_FUZZ_LOG_LEVEL]: raw,
      });
      assert.strictEqual(result?.logLevel, expected, `level for '${raw}'`);
    }
  });

  it("rejects bogus JAM_FUZZ_LOG_LEVEL", () => {
    assert.throws(
      () =>
        readFuzzEnv({
          [JAM_FUZZ]: "1",
          [JAM_FUZZ_SPEC]: "tiny",
          [JAM_FUZZ_SOCK_PATH]: "/tmp/s",
          [JAM_FUZZ_DATA_PATH]: "/tmp/d",
          [JAM_FUZZ_LOG_LEVEL]: "BOGUS",
        }),
      new RegExp(`${JAM_FUZZ_LOG_LEVEL} must be one of: error, warn, info, debug, trace`),
    );
  });
});

describe("synthesizeFuzzArgs", () => {
  it("builds a FuzzTarget Arguments value with tiny flavor override", () => {
    const args = synthesizeFuzzArgs({
      spec: KnownChainSpec.Tiny,
      socketPath: "/tmp/jam.sock",
      dataPath: "/tmp/jam-data",
      logLevel: null,
    });

    assert.deepStrictEqual(args, {
      command: Command.FuzzTarget,
      args: {
        nodeName: NODE_DEFAULTS.name,
        config: [...NODE_DEFAULTS.config, '.flavor="tiny"'],
        pvm: NODE_DEFAULTS.pvm,
        socket: "/tmp/jam.sock",
        version: 1,
        initGenesisFromAncestry: false,
      },
    });
  });

  it("uses 'full' flavor when spec is full", () => {
    const args = synthesizeFuzzArgs({
      spec: KnownChainSpec.Full,
      socketPath: "/tmp/jam.sock",
      dataPath: "/tmp/jam-data",
      logLevel: null,
    });
    if (args.command !== Command.FuzzTarget) {
      throw new Error("expected FuzzTarget command");
    }
    assert.deepStrictEqual(args.args.config, [...NODE_DEFAULTS.config, '.flavor="full"']);
  });
});
