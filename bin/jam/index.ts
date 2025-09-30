// biome-ignore-all lint/suspicious/noConsole: bin file

import { loadConfig } from "@typeberry/config-node";
import { deriveEd25519SecretKey } from "@typeberry/crypto/key-derivation.js";
import { Blake2b } from "@typeberry/hash";
import { Level, Logger } from "@typeberry/logger";
import { importBlocks, JamConfig, main, mainFuzz } from "@typeberry/node";
import { workspacePathFix } from "@typeberry/utils";
import { type Arguments, Command, HELP, parseArgs } from "./args.js";

export * from "./args.js";

Logger.configureAll(process.env.JAM_LOG ?? "", Level.LOG);

let args: Arguments;
const withRelPath = workspacePathFix(`${import.meta.dirname}/../..`);

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

function prepareConfigFile(args: Arguments, blake2b: Blake2b): JamConfig {
  const nodeConfig = loadConfig(args.args.configPath);
  const nodeName = args.command === Command.Dev ? `${args.args.nodeName}-${args.args.index}` : args.args.nodeName;

  const portShift = args.command === Command.Dev ? args.args.index : 0;
  const networkingKey = (() => {
    // NOTE [ToDr] in the future we should probably read the networking key
    // from some file or a database, since we want it to be consistent between runs.
    // For now, for easier testability, we use a deterministic seed.
    const seed = blake2b.hashString(nodeName);
    const key = deriveEd25519SecretKey(seed.asOpaque(), blake2b);
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
}

async function startNode(args: Arguments, withRelPath: (p: string) => string) {
  const blake2b = await Blake2b.createHasher();
  const jamNodeConfig = prepareConfigFile(args, blake2b);
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
