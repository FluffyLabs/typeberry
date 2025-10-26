// biome-ignore-all lint/suspicious/noConsole: bin file

import { Bootnode } from "@typeberry/config";
import { loadConfig } from "@typeberry/config-node";
import { ed25519 } from "@typeberry/crypto";
import { deriveEd25519SecretKey } from "@typeberry/crypto/key-derivation.js";
import { Blake2b } from "@typeberry/hash";
import { Level, Logger } from "@typeberry/logger";
import { altNameRaw } from "@typeberry/networking";
import { exportBlocks, importBlocks, JamConfig, main, mainFuzz } from "@typeberry/node";
import { asOpaqueType, workspacePathFix } from "@typeberry/utils";
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

async function prepareConfigFile(args: Arguments, blake2b: Blake2b): Promise<JamConfig> {
  const { nodeName: defaultNodeName } = args.args;
  const nodeConfig = loadConfig(args.args.configPath);
  const nodeName = args.command === Command.Dev ? devNodeName(defaultNodeName, args.args.index) : defaultNodeName;

  const devPortShift = args.command === Command.Dev ? args.args.index : 0;

  const devBootnodes =
    args.command === Command.Dev
      ? await Promise.all(
          Array.from({ length: 5 }).map(async (_, idx) => {
            const name = devNodeName(defaultNodeName, idx + 1);
            const seed = devNetworkingSeed(blake2b, name);
            const port = devPort(idx + 1);
            // Derive the peer ID from the public key using the same method as in certificate.ts
            const peerId = altNameRaw((await ed25519.privateKey(seed)).pubKey);
            return new Bootnode(asOpaqueType(peerId), "127.0.0.1", port);
          }),
        )
      : [];

  return JamConfig.new({
    isAuthoring: args.command === Command.Dev,
    nodeName,
    nodeConfig,
    pvmBackend: args.args.pvm,
    networkConfig: {
      key: devNetworkingSeed(blake2b, nodeName),
      host: "127.0.0.1",
      port: devPort(devPortShift),
      bootnodes: devBootnodes.concat(nodeConfig.chainSpec.bootnodes ?? []),
    },
  });
}

async function startNode(args: Arguments, withRelPath: (p: string) => string) {
  const blake2b = await Blake2b.createHasher();
  const jamNodeConfig = await prepareConfigFile(args, blake2b);
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

  if (args.command === Command.Export) {
    return await exportBlocks(jamNodeConfig, args.args.output, withRelPath);
  }

  // Run regular node.
  return main(jamNodeConfig, withRelPath);
}

function devNodeName(defaultNodeName: string, idx: number) {
  return `${defaultNodeName}-${idx}`;
}

function devPort(idx: number) {
  return 12345 + idx;
}

function devNetworkingSeed(blake2b: Blake2b, name: string) {
  // NOTE [ToDr] in the future we should probably read the networking key
  // from some file or a database, since we want it to be consistent between runs.
  // For now, for easier testability, we use a deterministic seed.
  const seed = blake2b.hashString(name);
  const key = deriveEd25519SecretKey(seed.asOpaque(), blake2b);
  return key;
}
