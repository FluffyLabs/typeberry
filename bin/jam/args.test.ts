import assert from "node:assert";
import { describe, it } from "node:test";

import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU16 } from "@typeberry/numbers";
import { deepEqual } from "@typeberry/utils";
import { Command, KnownChainSpec, type SharedOptions, parseArgs } from "./args.js";

describe("CLI", () => {
  const parse = (args: string[]) => parseArgs(args, "..");
  const defaultOptions: SharedOptions = {
    genesis: null,
    genesisBlock: null,
    genesisRoot: Bytes.parseBytes(
      "0xc07cdbce686c64d0a9b6539c70b0bb821b6a74d9de750a46a5da05b5640c290a",
      HASH_SIZE,
    ).asOpaque(),
    genesisHeaderHash: Bytes.parseBytes(
      "0x0259fbe900000000000000000000000000000000000000000000000000000000",
      HASH_SIZE,
    ).asOpaque(),
    dbPath: "../database",
    chainSpec: KnownChainSpec.Tiny,
    omitSealVerification: false,
  };

  it("should start with default arguments", () => {
    const args = parse([]);

    deepEqual(args, {
      command: Command.Run,
      args: defaultOptions,
    });
  });

  it("should parse chain spec option", () => {
    const args = parse(["--chain-spec=full"]);

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

  it("should parse genesisBlock option", () => {
    const args = parse(["--genesis-block=./genesis-block.json"]);

    deepEqual(args, {
      command: Command.Run,
      args: {
        ...defaultOptions,
        genesisBlock: ".././genesis-block.json",
      },
    });
  });

  it("should parse dbPath option", () => {
    const args = parse(["--db-path=mydb"]);

    deepEqual(args, {
      command: Command.Run,
      args: {
        ...defaultOptions,
        dbPath: "../mydb",
      },
    });
  });

  it("should parse genesisRoot option", () => {
    const args = parse(["--genesis-root=3fcf9728204359b93032b413eef3af0a0953d494b8b96e01550795b43b56c766"]);

    deepEqual(args, {
      command: Command.Run,
      args: {
        ...defaultOptions,
        genesisRoot: Bytes.parseBytesNoPrefix(
          "3fcf9728204359b93032b413eef3af0a0953d494b8b96e01550795b43b56c766",
          HASH_SIZE,
        ).asOpaque(),
      },
    });
  });

  it("should parse genesisHeaderHash option", () => {
    const args = parse(["--genesis-header-hash=3fcf9728204359b93032b413eef3af0a0953d494b8b96e01550795b43b56c766"]);

    deepEqual(args, {
      command: Command.Run,
      args: {
        ...defaultOptions,
        genesisHeaderHash: Bytes.parseBytesNoPrefix(
          "3fcf9728204359b93032b413eef3af0a0953d494b8b96e01550795b43b56c766",
          HASH_SIZE,
        ).asOpaque(),
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

  it("should parse dev-validator index", () => {
    const args = parse(["dev", "0xa"]);

    deepEqual(args, {
      command: Command.Dev,
      args: {
        ...defaultOptions,
        index: tryAsU16(10),
      },
    });
  });

  it("should parse omit-seal-verification without value as true", () => {
    const args = parse(["--omit-seal-verification"]);
    const args2 = parse(["--omit-seal-verification", "true"]);
    const args3 = parse(["--omit-seal-verification=true"]);

    deepEqual(args, {
      command: Command.Run,
      args: {
        ...defaultOptions,
        omitSealVerification: true,
      },
    });
    deepEqual(args, args2);
    deepEqual(args, args3);
  });

  it("should parse omit-seal-verification option with false (sign =)", () => {
    const args = parse(["--omit-seal-verification=false"]);

    deepEqual(args, {
      command: Command.Run,
      args: {
        ...defaultOptions,
        omitSealVerification: false,
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

  it("should fail on invalid option value", () => {
    assert.throws(
      () => {
        parse(["--chain-spec=xxx"]);
      },
      {
        message: "Invalid value 'xxx' for option 'chain-spec': Error: unknown chainspec",
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
