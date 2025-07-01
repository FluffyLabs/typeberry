import assert from "node:assert";
import { describe, it } from "node:test";

import { KnownChainSpec, OutputFormat, parseArgs } from "./args.js";
import { SUPPORTED_TYPES } from "./types.js";

const headerType = SUPPORTED_TYPES[1];

describe("CLI", () => {
  const parse = (args: string[]) => parseArgs(args, (v) => `../${v}`);
  const defaultArgs = {
    process: "",
    flavor: KnownChainSpec.Tiny,
    outputFormat: OutputFormat.Print,
  };

  it("should parse chain spec option", () => {
    const args = parse(["--flavor=full", "header", "./test.hex"]);

    assert.deepStrictEqual(args, {
      ...defaultArgs,
      flavor: KnownChainSpec.Full,
      type: headerType,
      inputPath: ".././test.hex",
    });
  });

  it("should parse chain process option", () => {
    const args = parse(["--process=root-hash", "header", "./test.hex"]);

    assert.deepStrictEqual(args, {
      ...defaultArgs,
      type: headerType,
      inputPath: ".././test.hex",
      process: "root-hash",
    });
  });

  it("should parse defaults", () => {
    const args = parse(["header", "./test.json"]);

    assert.deepStrictEqual(args, {
      ...defaultArgs,
      type: headerType,
      inputPath: ".././test.json",
    });
  });

  it("should parse json output", () => {
    const args = parse(["header", "./test.json", "to", "json"]);

    assert.deepStrictEqual(args, {
      ...defaultArgs,
      type: headerType,
      inputPath: ".././test.json",
      outputFormat: OutputFormat.Json,
    });
  });

  it("should parse hex output", () => {
    const args = parse(["header", "./test.json", "to", "hex"]);

    assert.deepStrictEqual(args, {
      ...defaultArgs,
      type: headerType,
      inputPath: ".././test.json",
      outputFormat: OutputFormat.Hex,
    });
  });

  it("should throw on unsupported output format", () => {
    assert.throws(
      () => {
        const _args = parse(["header", "./test.bin", "to", "something"]);
      },
      {
        message: "Invalid output format: 'something'.",
      },
    );
  });

  it("should throw on invalid syntax", () => {
    assert.throws(
      () => {
        const _args = parse(["header", "./test.bin", "into", "something"]);
      },
      {
        message: "Missing 'to' before the output type?",
      },
    );
  });

  it("should throw on unsupported type", () => {
    assert.throws(
      () => {
        const _args = parse(["unknown"]);
      },
      {
        message: "Unsupported input type: 'unknown'.",
      },
    );
  });
});
