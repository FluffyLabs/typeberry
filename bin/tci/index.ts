import { pathToFileURL } from "node:url";
import { tryAsTimeSlot, tryAsValidatorIndex } from "@typeberry/block";
import type { NodeConfiguration } from "@typeberry/config-node";
import { DEV_CONFIG } from "@typeberry/jam";
import { loadConfig } from "@typeberry/jam/main.js";
import { Level, Logger } from "@typeberry/logger";
import * as jam from "@typeberry/jam";
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
  const { args: jamArgs, config: jamConfig } = createJamArgsConf(argv);
  jam.main(jamArgs, withRelPath, jamConfig);
}

export function createJamArgsConf(argv: CommonArguments): { args: jam.Arguments, config: NodeConfiguration } {
  const args: string[] = [];
  if (argv.metadata !== undefined) {
    args.push(`--name=${argv.metadata}`);
  }
  if (argv.port !== undefined) {
    args.push(`--port=${argv.port}`);
  }

  const config = loadConfig(DEV_CONFIG);
  const { bandersnatch, bls, ed25519, datadir, genesis, ts, validatorindex } = argv;

  if (bandersnatch !== undefined) {
    config.authorship.bandersnatchSeed = bandersnatch;
  }
  if (bls !== undefined) {
    config.authorship.blsSeed = bls;
  }
  if (ed25519 !== undefined) {
    config.authorship.ed25519Seed = ed25519;
  }
  if (datadir !== undefined) {
    config.databaseBasePath = datadir;
  }
  if (genesis !== undefined) {
    config.authorship.genesisPath = genesis;
  }
  if (ts !== undefined) {
    config.authorship.timeSlot = tryAsTimeSlot(ts);
  }
  if (validatorindex !== undefined) {
    config.authorship.validatorIndex = tryAsValidatorIndex(validatorindex);
  }

  return { args: jam.parseArgs(args, withRelPath), config };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}
