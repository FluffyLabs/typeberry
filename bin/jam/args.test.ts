import assert from "node:assert";
import { describe, it } from "node:test";

import { deepEqual } from "@typeberry/utils";
import { Command, KnownChainSpec, type SharedOptions, parseArgs } from "./args";

describe("CLI", () => {
  const parse = (args: string[]) => parseArgs(args, "..");
  const defaultOptions: SharedOptions = {
    genesis: null,
    dbPath: "../database",
    chainSpec: KnownChainSpec.Tiny,
  };

  it("should start with default arguments", () => {
    const args = parse([]);

    deepEqual(args, {
      command: Command.Run,
      args: defaultOptions,
    });
  });

  it("should parse chain spec option", () => {
    const args = parse(["--chainSpec=full"]);

    deepEqual(args, {
      command: Command.Run,
      args: {
        ...defaultOptions,
        chainSpec: KnownChainSpec.Full,
      },
    });
  });

  it("should parse genesis option", () => {
    const args = parse(["--genesis=./genesis.json"]);

    deepEqual(args, {
      command: Command.Run,
      args: {
        ...defaultOptions,
        genesis: ".././genesis.json",
      },
    });
  });

  it("should parse dbPath option", () => {
    const args = parse(["--dbPath=mydb"]);

    deepEqual(args, {
      command: Command.Run,
      args: {
        ...defaultOptions,
        dbPath: "../mydb",
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

  it("should fail on invalid option value", () => {
    assert.throws(
      () => {
        const _args = parse(["--chainSpec=xxx"]);
      },
      {
        message: "Invalid value 'xxx' for option 'chainSpec': Error: unknown chainspec",
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
