// biome-ignore-all lint/suspicious/noConsole: bin file

import { Bootnode } from "@typeberry/config";
import { KnownChainSpec, loadConfig } from "@typeberry/config-node";
import { ed25519 } from "@typeberry/crypto";
import { deriveEd25519SecretKey } from "@typeberry/crypto/key-derivation.js";
import { Blake2b } from "@typeberry/hash";
import { Level, Logger } from "@typeberry/logger";
import { altNameRaw } from "@typeberry/networking";
import { exportBlocks, importBlocks, JamConfig, main, mainFuzz } from "@typeberry/node";
import { Telemetry } from "@typeberry/telemetry";
import { asOpaqueType, type Closer, workspacePathFix } from "@typeberry/utils";
import { installShutdownHandlers } from "@typeberry/utils/shutdown.node.js";
import { type Arguments, Command, HELP, parseArgs } from "./args.js";
import { readFuzzEnv, synthesizeFuzzArgs } from "./fuzz-env.js";

export * from "./args.js";

Logger.configureAll(process.env.JAM_LOG ?? "", Level.LOG);

let args: Arguments;
const withRelPath = workspacePathFix(`${import.meta.dirname}/../..`);

try {
  const fuzzEnv = readFuzzEnv(process.env);
  if (fuzzEnv !== null) {
    if (process.argv.length > 2) {
      throw new Error("When JAM_FUZZ is set, command-line arguments are not accepted.");
    }
    // In fuzz mode, the logger config is determined by JAM_FUZZ_LOG_LEVEL alone;
    // any JAM_LOG filters configured at module load are discarded so behavior is
    // deterministic regardless of which env vars happen to be present.
    Logger.configureAll("", fuzzEnv.logLevel ?? (fuzzEnv.spec === KnownChainSpec.Full ? Level.TRACE : Level.LOG));
    args = synthesizeFuzzArgs(fuzzEnv);
  } else {
    const parsed = parseArgs(process.argv.slice(2), withRelPath);
    if (parsed === null) {
      console.info(HELP);
      process.exit(0);
    }
    args = parsed;
  }
} catch (e) {
  console.error(`\n${e}\n`);
  console.info(HELP);
  process.exit(1);
}

// Install shutdown handlers as early as possible so signals during startup
// also exit cleanly. The closer is mutated by each startNode branch once it
// knows what to clean up.
let currentClose: Closer = async () => {};
installShutdownHandlers(() => currentClose(), { log: console });

const running = startNode(args, withRelPath, (c) => {
  currentClose = c;
});

running.catch((e) => {
  console.error(`${e}`);
  process.exit(-1);
});

function getPortShift(args: Arguments) {
  if (args.command !== Command.Dev) {
    return 0;
  }

  if (args.args.index === "all") {
    return -1;
  }

  return args.args.index;
}

async function prepareConfigFile(
  args: Arguments,
  blake2b: Blake2b,
  withRelPath: (p: string) => string,
): Promise<JamConfig> {
  const { nodeName: defaultNodeName } = args.args;
  const nodeConfig = loadConfig(args.args.config, withRelPath);
  const nodeName = args.command === Command.Dev ? devNodeName(defaultNodeName, args.args.index) : defaultNodeName;

  const devPortShift = getPortShift(args);

  const devBootnodes =
    args.command === Command.Dev
      ? await Promise.all(
          Array.from({ length: 5 }).map(async (_, idx) => {
            const name = devNodeName(defaultNodeName, idx + 1);
            const seed = devNetworkingSeed(blake2b, name);
            const port = devPort(idx + 1);
            // Derive the peer ID from the public key using the same method as in certificate.ts
            const peerId = altNameRaw((await ed25519.privateKey(seed)).pubKey);
            return Bootnode.new(asOpaqueType(peerId), "127.0.0.1", port);
          }),
        )
      : [];

  const isDevMode = args.command === Command.Dev;
  const devIndex = isDevMode ? args.args.index : null;
  const isFastForward = isDevMode ? args.args.isFastForward : false;

  return JamConfig.new({
    isAuthoring: isDevMode,
    isFastForward,
    nodeName,
    nodeConfig,
    pvmBackend: args.args.pvm,
    networkConfig: {
      key: devNetworkingSeed(blake2b, nodeName),
      host: "127.0.0.1",
      port: devPort(devPortShift),
      bootnodes: devBootnodes.concat(nodeConfig.chainSpec.bootnodes ?? []),
    },
    devValidatorIndex: devIndex,
  });
}

async function startNode(
  args: Arguments,
  withRelPath: (p: string) => string,
  setCloser: (c: Closer) => void,
): Promise<void> {
  const blake2b = await Blake2b.createHasher();
  const jamNodeConfig = await prepareConfigFile(args, blake2b, withRelPath);

  // Initialize OpenTelemetry before anything else
  const telemetry = Telemetry.initialize({
    isMain: true,
    nodeName: jamNodeConfig.nodeName,
    worker: "main",
  });

  // Start fuzz-target
  if (args.command === Command.FuzzTarget) {
    const version = args.args.version;
    const socket = args.args.socket;
    const initGenesisFromAncestry = args.args.initGenesisFromAncestry;
    const { close } = await mainFuzz({ jamNodeConfig, version, socket, initGenesisFromAncestry }, withRelPath);
    setCloser(close);
    return;
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
      telemetry,
    );
    let closePromise: Promise<void> | null = null;
    const closeNode = () => {
      closePromise ??= node.close();
      return closePromise;
    };
    setCloser(closeNode);
    try {
      await importBlocks(node, args.args.files);
    } finally {
      // Drain workers/db on both happy-path completion and signal-driven
      // shutdown — otherwise the process would hang on the still-active workers.
      await closeNode();
      setCloser(async () => {});
    }
    return;
  }

  if (args.command === Command.Export) {
    await exportBlocks(jamNodeConfig, args.args.output, withRelPath);
    return;
  }

  // Run regular node.
  const node = await main(jamNodeConfig, withRelPath, telemetry);
  setCloser(() => node.close());
}

function devNodeName(defaultNodeName: string, idx: number | string) {
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
