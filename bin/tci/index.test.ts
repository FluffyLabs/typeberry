import assert from "node:assert";
import { describe, it } from "node:test";
import { tryAsTimeSlot, tryAsValidatorIndex } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { loadConfig, NODE_DEFAULTS } from "@typeberry/config-node";
import { type PublicKeySeed, SEED_SIZE } from "@typeberry/crypto";
import { DEFAULT_DEV_CONFIG, JamConfig } from "@typeberry/node";
import { workspacePathFix } from "@typeberry/utils";
import { parseArgs } from "./args.js";
import { createJamConfig } from "./index.js";

const withRelPath = workspacePathFix(`${import.meta.dirname}/../..`);

describe("Typeberry Common Interface: Config", () => {
  const defaultJamConfig = JamConfig.new({
    nodeName: NODE_DEFAULTS.name,
    nodeConfig: loadConfig(NODE_DEFAULTS.config, withRelPath),
    devConfig: DEFAULT_DEV_CONFIG,
  });
  const key = Bytes.fill(SEED_SIZE, 1).asOpaque<PublicKeySeed>();

  it("should create default config", () => {
    const config = createJamConfig(parseArgs([]), withRelPath);
    assert.deepStrictEqual(config, defaultJamConfig);
  });

  it("should set database path", () => {
    const dbPath = "newdatabase/path";
    const config = createJamConfig(parseArgs(["--datadir", dbPath]), withRelPath);
    assert.deepStrictEqual(config.node.databaseBasePath, dbPath);
  });

  it("should set genesis path", () => {
    const genesisPath = "newGenesis";
    const config = createJamConfig(parseArgs(["--genesis", genesisPath]), withRelPath);
    assert.deepStrictEqual(config.dev?.genesisPath, genesisPath);
  });

  it("should set timeslot", () => {
    const config = createJamConfig(parseArgs(["--ts", "1234"]), withRelPath);
    assert.deepStrictEqual(config.dev?.timeSlot, tryAsTimeSlot(1234));
  });

  it("should set validator index", () => {
    const config = createJamConfig(parseArgs(["--validatorindex", "16"]), withRelPath);
    assert.deepStrictEqual(config.dev?.validatorIndex, tryAsValidatorIndex(16));
  });

  it("should create config with key seeds", () => {
    const config = createJamConfig(
      parseArgs(["--bandersnatch", key.toString(), "--bls", key.toString(), "--ed25519", key.toString()]),
      withRelPath,
    );
    assert.deepStrictEqual(
      { ...config },
      {
        ...defaultJamConfig,
        dev: {
          ...DEFAULT_DEV_CONFIG,
          seed: {
            bandersnatchSeed: key,
            blsSeed: key,
            ed25519Seed: key,
          },
        },
      },
    );
  });

  it("should fail if passed only one key seed", () => {
    assert.throws(
      () => {
        createJamConfig(parseArgs(["--bls", key.toString()]), withRelPath);
      },
      {
        message:
          "Incomplete seed configuration. You must provide all seeds or none. Provided: [bls]. Missing: [bandersnatch, ed25519].",
      },
    );
  });

  it("should fail if passed only two key seeds", () => {
    assert.throws(
      () => {
        createJamConfig(parseArgs(["--ed25519", key.toString(), "--bls", key.toString()]), withRelPath);
      },
      {
        message:
          "Incomplete seed configuration. You must provide all seeds or none. Provided: [bls, ed25519]. Missing: [bandersnatch].",
      },
    );
  });
});
