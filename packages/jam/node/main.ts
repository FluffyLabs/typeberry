import { isMainThread } from "node:worker_threads";

import type { BlockView, HeaderHash, HeaderView, StateRootHash } from "@typeberry/block";
import { type ChainSpec, WorkerConfig } from "@typeberry/config";
import { initWasm } from "@typeberry/crypto";
import type { Finished, MainInit } from "@typeberry/generic-worker";
import { Blake2b, type WithHash } from "@typeberry/hash";
import type { MainReady } from "@typeberry/importer/state-machine.js";
import * as blockImporter from "@typeberry/importer/worker.js";
import { NetworkWorkerConfig } from "@typeberry/jam-network/state-machine.js";
import type { Listener, MessageChannelStateMachine } from "@typeberry/state-machine";
import type { StateEntries } from "@typeberry/state-merkleization";
import { CURRENT_SUITE, CURRENT_VERSION, type Result } from "@typeberry/utils";
import { startBlockGenerator } from "./author.js";
import { getChainSpec, initializeDatabase, logger, openDatabase } from "./common.js";
import { initializeExtensions } from "./extensions.js";
import type { JamConfig, NetworkConfig } from "./jam-config.js";
import { startNetwork } from "./network.js";
import packageJson from "./package.json" with { type: "json" };

export type NodeApi = {
  chainSpec: ChainSpec;
  getStateEntries(hash: HeaderHash): Promise<StateEntries | null>;
  importBlock(block: BlockView): Promise<Result<StateRootHash, string>>;
  getBestStateRootHash(): Promise<StateRootHash>;
  close(): Promise<void>;
};

export async function main(config: JamConfig, withRelPath: (v: string) => string): Promise<NodeApi> {
  if (!isMainThread) {
    throw new Error("The main binary cannot be running as a Worker!");
  }

  await initWasm();

  logger.info`🫐 Typeberry ${packageJson.version}. GP: ${CURRENT_VERSION} (${CURRENT_SUITE})`;
  logger.info`🎸 Starting node: ${config.nodeName}.`;
  logger.info`🖥️ Interpreter: ${config.nodeInterpreter}.`;
  const chainSpec = getChainSpec(config.node.flavor);
  const blake2b = await Blake2b.createHasher();
  const { rootDb, dbPath, genesisHeaderHash } = openDatabase(
    blake2b,
    config.nodeName,
    config.node.chainSpec.genesisHeader,
    withRelPath(config.node.databaseBasePath),
  );

  // Initialize the database with genesis state and block if there isn't one.
  await initializeDatabase(chainSpec, blake2b, genesisHeaderHash, rootDb, config.node.chainSpec, config.ancestry);

  // Start extensions
  const importerInit = await blockImporter.spawnWorker();
  const bestHeader = importerInit.getState<MainReady>("ready(main)").onBestBlock;
  const closeExtensions = initializeExtensions({ chainSpec, bestHeader });

  // Start block importer
  const workerConfig = new WorkerConfig(
    chainSpec,
    dbPath,
    config.nodeInterpreter,
    config.node.authorship.omitSealVerification,
  );
  const importerReady = importerInit.transition((state, port) => {
    return state.sendConfig(port, workerConfig);
  });

  // Authorship initialization.
  // 1. load validator keys (bandersnatch, ed25519, bls)
  // 2. allow the validator to specify metadata.
  // 3. if we have validator keys, we should start the authorship module.
  const closeAuthorship = await initAuthorship(importerReady, config.isAuthoring, workerConfig);

  // Networking initialization
  const closeNetwork = await initNetwork(importerReady, workerConfig, genesisHeaderHash, config.network, bestHeader);

  const api: NodeApi = {
    chainSpec,
    async importBlock(block: BlockView) {
      return await importerReady.execute(async (importer, port) => {
        return importer.importBlock(port, block.encoded().raw);
      });
    },
    async getStateEntries(hash: HeaderHash) {
      return await importerReady.execute(async (importer, port) => {
        return importer.getStateEntries(port, hash.raw);
      });
    },
    async getBestStateRootHash() {
      return await importerReady.execute(async (importer, port) => {
        return importer.getBestStateRootHash(port);
      });
    },
    async close() {
      const importerFinished = importerReady.transition<Finished>((importer, port) => {
        return importer.finish(port);
      });
      await importerFinished.currentState().waitForWorkerToFinish();
      logger.log`[main] ☠️  Closing the extensions`;
      closeExtensions();
      logger.log`[main] ☠️  Closing the authorship module`;
      closeAuthorship();
      logger.log`[main] ☠️  Closing the networking module`;
      closeNetwork();
      logger.log`[main] 🛢️ Closing the database`;
      await rootDb.close();
      logger.info`[main] ✅ Done.`;
    },
  };

  return api;
}

type ImporterReady = MessageChannelStateMachine<MainReady, Finished | MainReady | MainInit<MainReady>>;

const initAuthorship = async (importerReady: ImporterReady, isAuthoring: boolean, config: WorkerConfig) => {
  if (!isAuthoring) {
    logger.log`✍️  Authorship off: disabled`;
    return () => Promise.resolve();
  }

  logger.info`✍️  Starting block generator.`;
  const { generator, finish } = await startBlockGenerator(config);
  // relay blocks from generator to importer
  importerReady.doUntil<Finished>("finished", async (importer, port) => {
    generator.currentState().onBlock.on((b) => {
      logger.log`✍️  Produced block. Size: [${b.length}]`;
      importer.sendBlock(port, b);
    });
  });

  return finish;
};

const initNetwork = async (
  importerReady: ImporterReady,
  workerConfig: WorkerConfig,
  genesisHeaderHash: HeaderHash,
  networkConfig: NetworkConfig | null,
  bestHeader: Listener<WithHash<HeaderHash, HeaderView>>,
) => {
  if (networkConfig === null) {
    logger.log`🛜 Networking off: no config`;
    return () => Promise.resolve();
  }

  const { key, host, port, bootnodes } = networkConfig;

  const { network, finish } = await startNetwork(
    NetworkWorkerConfig.new({
      genericConfig: workerConfig,
      genesisHeaderHash,
      key,
      host,
      port,
      bootnodes: bootnodes.map((node) => node.toString()),
    }),
  );

  // relay blocks from networking to importer?
  importerReady.doUntil("finished", async (importer, port) => {
    network.currentState().onNewBlocks.on((newBlocks) => {
      for (const block of newBlocks) {
        importer.sendBlock(port, block.encoded().raw);
      }
    });
  });

  // relay newly imported headers to trigger network announcements
  network.doUntil("finished", async (network, port) => {
    bestHeader.on((header) => {
      network.announceHeader(port, header);
    });
  });

  return finish;
};
