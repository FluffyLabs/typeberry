import { tryAsTimeSlot, tryAsValidatorIndex } from "@typeberry/block";
import type { NodeConfiguration } from "@typeberry/config-node";
import { DEV_CONFIG } from "@typeberry/jam";
import { loadConfig } from "@typeberry/jam/main.js";
import { Level, Logger } from "@typeberry/logger";
import { main as mainRpc } from "@typeberry/rpc";
import { type CommonArguments, parseArgs } from "./args.js";

Logger.configureAll(process.env.JAM_LOG ?? "", Level.LOG);

/**
 * JAM Node entry w/ common command lines arguments
 * understood by all JAM nodes implementations
 *
 * https://docs.jamcha.in/basics/cli-args
 */
export async function main(args: string[]) {
  const argv = parseArgs(args);
  const rpcArgs = rpcConfig(argv);
  const config = jamConfig(argv);
  mainRpc(rpcArgs, config);
}

export function jamConfig(argv: CommonArguments): NodeConfiguration {
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

  return config;
}

export function rpcConfig(argv: CommonArguments): string[] {
  const args: string[] = [];
  if (argv.metadata !== undefined) {
    args.push(`--nodeName=${argv.metadata}`);
  }
  if (argv.port !== undefined) {
    args.push(`--port=${argv.port}`);
  }
  return args;
}

main(process.argv.slice(2));
