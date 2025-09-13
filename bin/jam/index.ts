import { pathToFileURL } from "node:url";
import { loadConfig } from "@typeberry/config-node";
import { deriveEd25519SecretKey } from "@typeberry/crypto/key-derivation.js";
import { blake2b } from "@typeberry/hash";
import { Level, Logger } from "@typeberry/logger";
import { JamConfig, importBlocks, main, mainFuzz } from "@typeberry/node";
import { type Arguments, Command, HELP, parseArgs } from "./args.js";

export * from "./args.js";

export const prepareConfigFile = (args: Arguments): JamConfig => {
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
    const parsed = parseArgs(process.argv.slice(2), withRelPath);
    if (parsed === null) {
      console.info(HELP);
      process.exit(0);
    }
    args = parsed;
  } catch (e) {
    console.error(`\n${e}\n`);
    console.info(HELP);
    process.exit(1);
  }

  const running = startNode(args, withRelPath);

  running.catch((e) => {
    console.error(`${e}`);
    process.exit(-1);
  });
}

async function startNode(args: Arguments, withRelPath: (p: string) => string) {
  const jamNodeConfig = prepareConfigFile(args);
  // Start fuzz-target
  if (args.command === Command.FuzzTarget) {
    const version = args.args.version;
    const socket = args.args.socket;
    return mainFuzz({ jamNodeConfig, version, socket }, withRelPath);
  }

  // Just import a bunch of blocks
  if (args.command === Command.Import) {
    const node = await main(
      {
        ...jamNodeConfig,
        // disable networking for import, since we close right after.
        network: null,
      },
      withRelPath,
    );
    return await importBlocks(node, args.args.files);
  }

  // Run regular node.
  return main(jamNodeConfig, withRelPath);
}
