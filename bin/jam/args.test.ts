import assert from "node:assert";
import { describe, it } from "node:test";

import { deepEqual } from "@typeberry/utils";
import { Command, DEFAULTS, type SharedOptions, parseArgs } from "./args.js";

describe("CLI", () => {
  const parse = (args: string[]) => parseArgs(args, (v) => `../${v}`);
  const defaultOptions: SharedOptions = {
    nodeName: DEFAULTS.name,
    configPath: DEFAULTS.config,
  };

  it("should start with default arguments", () => {
    const args = parse([]);

    deepEqual(args, {
      command: Command.Run,
      args: defaultOptions,
    });
  });

  it("should parse name option", () => {
    const args = parse(["--name='my silly name'"]);

    deepEqual(args, {
      command: Command.Run,
      args: {
        ...defaultOptions,
        nodeName: "my sill name",
      },
    });
  });

  it("should parse config option", () => {
    const args = parse(["--config=./config.json"]);

    deepEqual(args, {
      command: Command.Run,
      args: {
        ...defaultOptions,
        configPath: ".././config.json",
      },
    });
  });

  it("should parse dev config option", () => {
    const args = parse(["--config=dev"]);

    deepEqual(args, {
      command: Command.Run,
      args: {
        ...defaultOptions,
        configPath: "dev",
      },
    });
  });

  it("should parse import command and add rel path to files", () => {
    const args = parse(["import", "./file1.json", "./file2.json"]);

    deepEqual(args, {
      command: Command.Import,
      args: {
        ...defaultOptions,
        files: [".././file1.json", ".././file2.json"],
      },
    });
  });

  it("should throw on unexpected command", () => {
    assert.throws(
      () => {
        const _args = parse(["unknown"]);
      },
      {
        message: "Unexpected command: 'unknown'",
      },
    );
  });

  it("should throw on unexpected options", () => {
    assert.throws(
      () => {
        const _args = parse(["run", "--myoption", "x"]);
      },
      {
        message: "Unrecognized options: 'myoption'",
      },
    );
  });

  it("should throw on unexpected run args", () => {
    assert.throws(
      () => {
        const _args = parse(["run", "x"]);
      },
      {
        message: "Unexpected command: 'x'",
      },
    );
  });

  it("should throw on unexpected extra args", () => {
    assert.throws(
      () => {
        const _args = parse(["run", "--", "x"]);
      },
      {
        message: "Unexpected command: 'x'",
      },
    );
  });
});
