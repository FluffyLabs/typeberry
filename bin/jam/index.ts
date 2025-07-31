import { pathToFileURL } from "node:url";
import { Bytes } from "@typeberry/bytes";
import { loadConfig } from "@typeberry/config-node";
import { SEED_SIZE, deriveEd25519SecretKey, trivialSeed } from "@typeberry/crypto/key-derivation.js";
import { Level, Logger } from "@typeberry/logger";
import { JamConfig, main } from "@typeberry/node";
import { tryAsU32 } from "@typeberry/numbers";
import { type Arguments, Command, HELP, parseArgs } from "./args.js";

export * from "./args.js";

export const prepareConfigFile = (args: Arguments): JamConfig => {
  const blocksToImport = args.command === Command.Import ? args.args.files : null;
  const nodeConfig = loadConfig(args.args.configPath);

  const portShift = args.command === Command.Dev ? args.args.index : 0;
  const networkingKey = (() => {
    // TODO [ToDr] in the future we should probably read the networking key
    // from some file or a database, since we want it to be consistent between runs.
    // For now, for easier testability, we use a deterministic seed.
    const seed =
      args.command === Command.Dev ? trivialSeed(tryAsU32(args.args.index)) : Bytes.zero(SEED_SIZE).asOpaque();
    const key = deriveEd25519SecretKey(seed);
    return key;
  })();

  return JamConfig.new({
    isAuthoring: args.command === Command.Dev,
    blocksToImport,
    nodeName: args.args.nodeName,
    nodeConfig,
    networkConfig: {
      key: networkingKey,
      host: "127.0.0.1",
      port: 12345 + portShift,
      bootnodes: nodeConfig.chainSpec.bootnodes ?? [],
    },
  });
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  Logger.configureAll(process.env.JAM_LOG ?? "", Level.LOG);
  const relPath = `${import.meta.dirname}/../..`;
  const withRelPath = (p: string) => {
    if (p.startsWith("/")) {
      return p;
    }
    return `${relPath}/${p}`;
  };

  let args: Arguments;

  try {
    args = parseArgs(process.argv.slice(2), withRelPath);
  } catch (e) {
    console.error(`\n${e}\n`);
    console.info(HELP);
    process.exit(1);
  }

  main(prepareConfigFile(args), withRelPath).catch((e) => {
    console.error(`${e}`);
    process.exit(-1);
  });
}
