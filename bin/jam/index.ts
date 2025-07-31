import { pathToFileURL } from "node:url";
import { loadConfig } from "@typeberry/config-node";
import { deriveEd25519SecretKey } from "@typeberry/crypto/key-derivation.js";
import { blake2b } from "@typeberry/hash";
import { Level, Logger } from "@typeberry/logger";
import { JamConfig, main } from "@typeberry/node";
import { type Arguments, Command, HELP, parseArgs } from "./args.js";

export * from "./args.js";

export const prepareConfigFile = (args: Arguments): JamConfig => {
  const blocksToImport = args.command === Command.Import ? args.args.files : null;
  const nodeConfig = loadConfig(args.args.configPath);
  const nodeName = args.command === Command.Dev ? `${args.args.nodeName}-${args.args.index}` : args.args.nodeName;

  const portShift = args.command === Command.Dev ? args.args.index : 0;
  const networkingKey = (() => {
    // NOTE [ToDr] in the future we should probably read the networking key
    // from some file or a database, since we want it to be consistent between runs.
    // For now, for easier testability, we use a deterministic seed.
    const seed = blake2b.hashString(nodeName);
    const key = deriveEd25519SecretKey(seed.asOpaque());
    return key;
  })();

  return JamConfig.new({
    isAuthoring: args.command === Command.Dev,
    nodeName,
    blocksToImport,
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
