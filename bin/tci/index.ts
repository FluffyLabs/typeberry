import { pathToFileURL } from "node:url";
import { tryAsTimeSlot, tryAsValidatorIndex } from "@typeberry/block";
import * as jam from "@typeberry/jam";
import { Level, Logger } from "@typeberry/logger";
import { DEFAULTS, DEV_CONFIG_PATH } from "../jam-cli/args.js";
import { type CommonArguments, parseArgs } from "./args.js";

Logger.configureAll(process.env.JAM_LOG ?? "", Level.LOG);
const withRelPath = (v: string) => v;

/**
 * JAM Node entry w/ common command lines arguments
 * understood by all JAM nodes implementations
 *
 * https://docs.jamcha.in/basics/cli-args
 */
export async function main(args: string[]) {
  const argv = parseArgs(args);
  const config = createJamConfig(argv);
  jam.main(config, withRelPath);
}

export function createJamConfig(argv: CommonArguments): jam.JamConfig {
  // TODO: [MaSo] Add networking config; add loading from genesis path

  let nodeConfig = jam.loadConfig(DEV_CONFIG_PATH);
  let devConfig = jam.DEV_CONFIG;
  let seedConfig: jam.SeedDevConfig | undefined;
  const requiredSeedKeys = ["bandersnatch", "bls", "ed25519"] as const;
  type RequiredSeedKey = (typeof requiredSeedKeys)[number];

  const provided = requiredSeedKeys.filter((key: RequiredSeedKey) => argv[key] !== undefined);
  if (provided.length > 0) {
    const missing = requiredSeedKeys.filter((key: RequiredSeedKey) => argv[key] === undefined);
    if (missing.length > 0) {
      throw new Error(
        `Incomplete seed configuration. You must provide all seeds or none. Provided: [${provided.join(", ")}]. Missing: [${missing.join(", ")}].`,
      );
    }
    // NOTE: [MaSo] here all the flags should NOT be `undefined`, but TS can't figure it out
    if (argv.bandersnatch !== undefined && argv.bls !== undefined && argv.ed25519 !== undefined) {
      seedConfig = {
        bandersnatchSeed: argv.bandersnatch,
        blsSeed: argv.bls,
        ed25519Seed: argv.ed25519,
      };
    }
  }

  if (argv.datadir !== undefined) {
    nodeConfig = {
      ...nodeConfig,
      databaseBasePath: argv.datadir,
    };
  }
  if (argv.genesis !== undefined) {
    devConfig = {
      ...devConfig,
      genesisPath: argv.genesis,
    };
  }
  if (argv.ts !== undefined) {
    devConfig = {
      ...devConfig,
      timeSlot: tryAsTimeSlot(argv.ts),
    };
  }
  if (argv.validatorindex !== undefined) {
    devConfig = {
      ...devConfig,
      validatorIndex: tryAsValidatorIndex(argv.validatorindex),
    };
  }

  return jam.JamConfig.new({ nodeName: DEFAULTS.name, nodeConfig, devConfig, seedConfig });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}
