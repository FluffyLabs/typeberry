import assert from "node:assert";
import { describe, it } from "node:test";

import { KnownChainSpec, OutputFormat, parseArgs } from "./args.js";
import { SUPPORTED_TYPES } from "./types.js";

const anyType = SUPPORTED_TYPES[0];
const headerType = SUPPORTED_TYPES.find(({ name }) => name === "header") ?? anyType;
const stateDumpType = SUPPORTED_TYPES.find(({ name }) => name === "state-dump") ?? anyType;

describe("CLI", () => {
  const parse = (args: string[]) => parseArgs(args, (v) => `../${v}`);
  const defaultArgs = {
    process: "",
    flavor: KnownChainSpec.Tiny,
    outputFormat: OutputFormat.Print,
  };

  it("should parse chain spec option", () => {
    const args = parse(["--flavor=full", "./test.hex", "header"]);

    assert.deepStrictEqual(args, {
      ...defaultArgs,
      flavor: KnownChainSpec.Full,
      type: headerType,
      inputPath: ".././test.hex",
    });
  });

  it("should parse process option alone", () => {
    const args = parse(["./test.hex", "state-dump", "as-root-hash"]);

    assert.deepStrictEqual(args, {
      ...defaultArgs,
      type: stateDumpType,
      inputPath: ".././test.hex",
      process: "as-root-hash",
    });
  });

  it("should parse process option and output", () => {
    const args = parse(["./test.hex", "state-dump", "as-root-hash", "to-hex"]);

    assert.deepStrictEqual(args, {
      ...defaultArgs,
      type: stateDumpType,
      inputPath: ".././test.hex",
      process: "as-root-hash",
      outputFormat: OutputFormat.Hex,
    });
  });

  it("should parse defaults", () => {
    const args = parse(["./test.json", "header"]);

    assert.deepStrictEqual(args, {
      ...defaultArgs,
      type: headerType,
      inputPath: ".././test.json",
    });
  });

  it("should parse json output", () => {
    const args = parse(["./test.json", "header", "to-json"]);

    assert.deepStrictEqual(args, {
      ...defaultArgs,
      type: headerType,
      inputPath: ".././test.json",
      outputFormat: OutputFormat.Json,
    });
  });

  it("should parse hex output", () => {
    const args = parse(["./test.json", "header", "to-hex"]);

    assert.deepStrictEqual(args, {
      ...defaultArgs,
      type: headerType,
      inputPath: ".././test.json",
      outputFormat: OutputFormat.Hex,
    });
  });

  it("should throw on unsupported output format with processing", () => {
    assert.throws(
      () => {
        const _args = parse(["./test.bin", "state-dump", "as-root-hash", "to-something"]);
      },
      {
        message: "Invalid output format: 'to-something'.",
      },
    );
  });

  it("should throw on unsupported output format or processing", () => {
    assert.throws(
      () => {
        const _args = parse(["./test.bin", "header", "to-something"]);
      },
      {
        message: "'to-something' is neither output format nor processing parameter.",
      },
    );
  });

  it("should throw on invalid syntax", () => {
    assert.throws(
      () => {
        const _args = parse(["./test.bin", "header", "into", "something", "x"]);
      },
      {
        message: "Unexpected command: 'x'",
      },
    );
  });

  it("should throw on missing input type", () => {
    assert.throws(
      () => {
        const _args = parse(["./header.json"]);
      },
      {
        message: "Missing input type.",
      },
    );
  });

  it("should throw on unsupported type", () => {
    assert.throws(
      () => {
        const _args = parse(["./header.json", "unknown"]);
      },
      {
        message: "Unsupported input type: 'unknown'.",
      },
    );
  });
});
