import assert from "node:assert";
import { describe, it } from "node:test";

import { NODE_DEFAULTS, PVMBackend } from "@typeberry/config-node";
import { tryAsU16 } from "@typeberry/numbers";
import { deepEqual } from "@typeberry/utils";
import { Command, parseArgs, type SharedOptions } from "./args.js";

describe("CLI", () => {
  const parse = (args: string[]) => parseArgs(args, (v) => `../${v}`);
  const defaultOptions: SharedOptions = {
    nodeName: NODE_DEFAULTS.name,
    configPath: NODE_DEFAULTS.config,
    pvm: NODE_DEFAULTS.pvm,
  };

  it("should start with default arguments", () => {
    const args = parse([]);

    deepEqual(args, {
      command: Command.Run,
      args: defaultOptions,
    });
  });

  it("should parse name option", () => {
    const args = parse(["--name=my silly name"]);

    deepEqual(args, {
      command: Command.Run,
      args: {
        ...defaultOptions,
        nodeName: "my silly name",
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

  it("should parse export command and add rel path to output path", () => {
    const args = parse(["export", "./output"]);

    deepEqual(args, {
      command: Command.Export,
      args: {
        ...defaultOptions,
        output: ".././output",
      },
    });
  });

  it("should parse pvm option", () => {
    const args = parse(["--pvm=ananas"]);

    deepEqual(args, {
      command: Command.Run,
      args: {
        ...defaultOptions,
        pvm: PVMBackend.Ananas,
      },
    });
  });

  it("should throw on missing pvm option", () => {
    assert.throws(
      () => {
        const _args = parse(["--pvm=unimplemented"]);
      },
      {
        message: "Invalid value 'unimplemented' for option 'pvm': Error: Use one of builtin, ananas, builtinananas",
      },
    );
  });

  it("should throw on missing output path", () => {
    assert.throws(
      () => {
        const _args = parse(["export"]);
      },
      {
        message: "Missing output directory.",
      },
    );
  });

  it("should parse dev-validator index", () => {
    const args = parse(["dev", "0xa"]);

    deepEqual(args, {
      command: Command.Dev,
      args: {
        ...defaultOptions,
        configPath: "dev",
        index: tryAsU16(10),
      },
    });
  });

  it("should throw on unexpected command", () => {
    assert.throws(
      () => {
        parse(["unknown"]);
      },
      {
        message: "Unexpected command: 'unknown'",
      },
    );
  });

  it("should throw on missing dev-validator index", () => {
    assert.throws(
      () => {
        const _args = parse(["dev"]);
      },
      {
        message: "Missing dev-validator index.",
      },
    );
  });

  it("should throw on invalid dev-validator index", () => {
    assert.throws(
      () => {
        const _args = parse(["dev", "1.5"]);
      },
      {
        message: "Invalid dev-validator index: 1.5, need U16",
      },
    );
  });

  it("should throw on unexpected options", () => {
    assert.throws(
      () => {
        parse(["run", "--myoption", "x"]);
      },
      {
        message: "Unrecognized options: 'myoption'",
      },
    );
  });

  it("should throw on unexpected run args", () => {
    assert.throws(
      () => {
        parse(["run", "x"]);
      },
      {
        message: "Unexpected command: 'x'",
      },
    );
  });

  it("should throw on unexpected extra args", () => {
    assert.throws(
      () => {
        parse(["run", "--", "x"]);
      },
      {
        message: "Unexpected command: 'x'",
      },
    );
  });
});
