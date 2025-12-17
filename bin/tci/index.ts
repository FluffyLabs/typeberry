// biome-ignore-all lint/suspicious/noConsole: bin file

import { pathToFileURL } from "node:url";
import { tryAsTimeSlot, tryAsValidatorIndex } from "@typeberry/block";
import { loadConfig, NODE_DEFAULTS } from "@typeberry/config-node";
import { Level, Logger } from "@typeberry/logger";
import * as node from "@typeberry/node";
import { workspacePathFix } from "@typeberry/utils";
import { type CommonArguments, HELP, parseArgs, type RequiredFlag, requiredSeedFlags } from "./args.js";

Logger.configureAll(process.env.JAM_LOG ?? "", Level.LOG);
const withRelPath = workspacePathFix(`${import.meta.dirname}/../..`);

/**
 * JAM Node entry w/ common command lines arguments
 * understood by all JAM nodes implementations
 *
 * https://docs.jamcha.in/basics/cli-args
 */
export async function main(args: string[]) {
  let argv: CommonArguments;
  let config: node.JamConfig;
  try {
    argv = parseArgs(args);
    config = createJamConfig(argv, withRelPath);
  } catch (e) {
    console.error(`\n${e}\n`);
    console.info(HELP);
    process.exit(1);
  }
  node.main(config, withRelPath, null);
}

export function createJamConfig(argv: CommonArguments, withRelPath: (p: string) => string): node.JamConfig {
  let nodeConfig = loadConfig(NODE_DEFAULTS.config, withRelPath);
  let devConfig: node.DevConfig = {
    ...node.DEFAULT_DEV_CONFIG,
  };

  if (argv.bandersnatch !== undefined && argv.bls !== undefined && argv.ed25519 !== undefined) {
    devConfig.seed = {
      bandersnatchSeed: argv.bandersnatch,
      blsSeed: argv.bls,
      ed25519Seed: argv.ed25519,
    };
  } else {
    const provided = requiredSeedFlags.filter((key: RequiredFlag) => argv[key] !== undefined);
    if (provided.length > 0) {
      const missing = requiredSeedFlags.filter((key: RequiredFlag) => argv[key] === undefined);
      if (missing.length > 0) {
        throw new Error(
          `Incomplete seed configuration. You must provide all seeds or none. Provided: [${provided.join(", ")}]. Missing: [${missing.join(", ")}].`,
        );
      }
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

  return node.JamConfig.new({
    nodeName: NODE_DEFAULTS.name,
    nodeConfig,
    devConfig,
    pvmBackend: NODE_DEFAULTS.pvm,
    accumulateSequentially: NODE_DEFAULTS.accumulateSequentially,
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}
