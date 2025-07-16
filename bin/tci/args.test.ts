import assert from "node:assert";
import { describe, it } from "node:test";

import { Bytes } from "@typeberry/bytes";
import { type PublicKeySeed, SEED_SIZE } from "@typeberry/crypto";
import { type CommonArguments, parseArgs } from "./args.js";

describe("Typeberry Common Interface (TCI): Arguments", () => {
  const hex32 = "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20";
  const hex32with0x = `0x${hex32}`;
  const expectedBytes = Bytes.parseBytesNoPrefix(hex32, SEED_SIZE).asOpaque<PublicKeySeed>();
  const path = "../mydata";

  const defaultArgs: CommonArguments = {
    bandersnatch: undefined,
    bls: undefined,
    datadir: undefined,
    ed25519: undefined,
    genesis: undefined,
    metadata: "Alice",
    port: undefined,
    ts: undefined,
    validatorindex: undefined,
  };

  it("should parse bandersnatch seed with 0x", () => {
    const args = parseArgs(["--bandersnatch", hex32with0x]);

    assert.deepStrictEqual(args, {
      ...defaultArgs,
      bandersnatch: expectedBytes,
    });
  });

  it("should parse bandersnatch seed", () => {
    const args = parseArgs(["--bandersnatch", hex32]);

    assert.deepStrictEqual(args, {
      ...defaultArgs,
      bandersnatch: expectedBytes,
    });
  });

  it("should parse bls seed with 0x", () => {
    const args = parseArgs(["--bls", hex32with0x]);

    assert.deepStrictEqual(args, {
      ...defaultArgs,
      bls: expectedBytes,
    });
  });

  it("should parse bls seed", () => {
    const args = parseArgs(["--bls", hex32]);

    assert.deepStrictEqual(args, {
      ...defaultArgs,
      bls: expectedBytes,
    });
  });

  it("should parse ed25519 seed with 0x", () => {
    const args = parseArgs(["--ed25519", hex32with0x]);

    assert.deepStrictEqual(args, {
      ...defaultArgs,
      ed25519: expectedBytes,
    });
  });

  it("should parse ed25519 seed", () => {
    const args = parseArgs(["--ed25519", hex32]);

    assert.deepStrictEqual(args, {
      ...defaultArgs,
      ed25519: expectedBytes,
    });
  });

  it("should parse datadir path", () => {
    const args = parseArgs(["--datadir", path]);

    assert.deepStrictEqual(args, {
      ...defaultArgs,
      datadir: path,
    });
  });

  it("should parse genesis path", () => {
    const args = parseArgs(["--genesis", path]);

    assert.deepStrictEqual(args, {
      ...defaultArgs,
      genesis: path,
    });
  });

  it("should parse metadata value", () => {
    const meta = "some example metadata that can be passed";
    const args = parseArgs(["--metadata", meta]);

    assert.deepStrictEqual(args, {
      ...defaultArgs,
      metadata: meta,
    });
  });

  it("should parse port path", () => {
    const args = parseArgs(["--port", "9009"]);

    assert.deepStrictEqual(args, {
      ...defaultArgs,
      port: 9009,
    });
  });

  it("should parse ts path", () => {
    const args = parseArgs(["--ts", "10"]);

    assert.deepStrictEqual(args, {
      ...defaultArgs,
      ts: 10,
    });
  });

  it("should parse validatorindex path", () => {
    const args = parseArgs(["--validatorindex", "0xbeef"]);

    assert.deepStrictEqual(args, {
      ...defaultArgs,
      validatorindex: 0xbeef,
    });
  });

  it("should throw Invalid value: too short hex", () => {
    assert.throws(() => parseArgs(["--bls", "0102030405060708"]), {
      message: "Invalid value '0102030405060708' for flag '--bls': Error: Assertion failure: Given buffer has incorrect size 8 vs expected 32",
    });
  });

  it("should throw Invalid value: too long hex", () => {
    assert.throws(() => parseArgs(["--bls", "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f2021"]), {
      message:
        "Invalid value '0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f2021' for flag '--bls': Error: Assertion failure: Given buffer has incorrect size 33 vs expected 32",
    });
  });

  it("should throw value cannot be parsed as a number", () => {
    assert.throws(() => parseArgs(["--ts", "test"]), {
      message: "Invalid value 'test' for flag '--ts': Error: Cannot parse 'test' as a number.",
    });
  });

  it("should throw value required", () => {
    assert.throws(() => parseArgs(["--port"]), {
      message: "Option --port requires an argument.",
    });
  });

  it("should throw unexpected command", () => {
    assert.throws(() => parseArgs(["unknown"]), {
      message: "Unexpected commands: unknown",
    });
  });

  it("should throw unrecognized flag", () => {
    assert.throws(() => parseArgs(["--unknown", "value"]), {
      message: "Unrecognized flags: unknown",
    });
  });
});
