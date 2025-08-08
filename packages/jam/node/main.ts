import { isMainThread } from "node:worker_threads";

import type { BlockView, HeaderHash, HeaderView, StateRootHash } from "@typeberry/block";
import { type ChainSpec, WorkerConfig } from "@typeberry/config";
import type { Finished, MainInit } from "@typeberry/generic-worker";
import type { WithHash } from "@typeberry/hash";
import * as blockImporter from "@typeberry/importer";
import type { MainReady } from "@typeberry/importer/state-machine.js";
import { NetworkWorkerConfig } from "@typeberry/jam-network/state-machine.js";
import type { Listener, MessageChannelStateMachine } from "@typeberry/state-machine";
import type { StateEntries } from "@typeberry/state-merkleization";
import { startBlockGenerator } from "./author.js";
import { getChainSpec, initializeDatabase, logger, openDatabase } from "./common.js";
import { initializeExtensions } from "./extensions.js";
import type { JamConfig, NetworkConfig } from "./jam-config.js";
import { startNetwork } from "./network.js";
import { startBlocksReader } from "./reader.js";

export type NodeApi = {
  getStateEntries(hash: HeaderHash): Promise<StateEntries | null>;
  importBlock(block: BlockView): Promise<StateRootHash | null>;
  getBestStateRootHash(): Promise<StateRootHash>;
  close(): Promise<void>;
  waitForFinish(): Promise<void>;
};

export async function main(config: JamConfig, withRelPath: (v: string) => string): Promise<NodeApi> {
  if (!isMainThread) {
    throw new Error("The main binary cannot be running as a Worker!");
  }

  logger.info(`🎸 Starting node: ${config.nodeName}`);
  const chainSpec = getChainSpec(config.node.flavor);
  const { rootDb, dbPath, genesisHeaderHash } = openDatabase(
    config.nodeName,
    config.node.chainSpec.genesisHeader,
    withRelPath(config.node.databaseBasePath),
  );

  // Initialize the database with genesis state and block if there isn't one.
  await initializeDatabase(chainSpec, genesisHeaderHash, rootDb, config.node.chainSpec);

  // Start extensions
  const importerInit = await blockImporter.spawnWorker();
  const bestHeader = importerInit.getState<MainReady>("ready(main)").onBestBlock;
  const closeExtensions = initializeExtensions({ chainSpec, bestHeader });

  // Start block importer
  const workerConfig = new WorkerConfig(chainSpec, dbPath, config.node.authorship.omitSealVerification);
  const importerReady = importerInit.transition((state, port) => {
    return state.sendConfig(port, workerConfig);
  });

  // TODO [ToDr] This should be outside of the node and should just use NodeApi to import
  // the blocks.
  //
  // Initialize block reader and wait for it to finish
  const blocksReader = initBlocksReader(importerReady, chainSpec, config.blocksToImport);

  // Authorship initialization.
  // 1. load validator keys (bandersnatch, ed25519, bls)
  // 2. allow the validator to specify metadata.
  // 3. if we have validator keys, we should start the authorship module.
  const closeAuthorship = await initAuthorship(
    importerReady,
    config.isAuthoring && config.blocksToImport === null,
    workerConfig,
  );

  // Networking initialization
  const closeNetwork = await initNetwork(
    importerReady,
    workerConfig,
    genesisHeaderHash,
    config.network,
    config.blocksToImport === null,
    bestHeader,
  );

  return {
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
      importerReady.transition<Finished>((importer, port) => {
        return importer.finish(port);
      });
      return await (await this).waitForFinish();
    },
    async waitForFinish() {
      logger.info("[main]⌛ waiting for importer to finish");
      const importerDone = await blocksReader;
      logger.log("[main] ☠️  Closing the extensions");
      closeExtensions();
      logger.log("[main]⌛ waiting for tasks to finish");
      await importerDone.currentState().waitForWorkerToFinish();
      logger.log("[main] ☠️  Closing the authorship module");
      closeAuthorship();
      logger.log("[main] ☠️  Closing the networking module");
      closeNetwork();
      logger.log("[main] 🛢️ Closing the database");
      await rootDb.close();
      logger.info("[main] ✅ Done.");
    },
  };
}

type ImporterReady = MessageChannelStateMachine<MainReady, Finished | MainReady | MainInit<MainReady>>;

const initAuthorship = async (importerReady: ImporterReady, isAuthoring: boolean, config: WorkerConfig) => {
  if (!isAuthoring) {
    logger.log("✍️  Authorship off: disabled");
    return () => Promise.resolve();
  }

  logger.info("✍️  Starting block generator.");
  const { generator, finish } = await startBlockGenerator(config);
  // relay blocks from generator to importer
  importerReady.doUntil<Finished>("finished", async (importer, port) => {
    generator.currentState().onBlock.on((b) => {
      logger.log(`✍️  Produced block. Size: [${b.length}]`);
      importer.sendBlock(port, b);
    });
  });

  return finish;
};

const initBlocksReader = async (
  importerReady: ImporterReady,
  chainSpec: ChainSpec,
  blocksToImport: string[] | null,
) => {
  if (blocksToImport === null) {
    return importerReady.waitForState<Finished>("finished");
  }

  logger.info(`📖 Reading ${blocksToImport.length} blocks`);
  return importerReady.transition<Finished>((importer, port) => {
    const reader = startBlocksReader({
      files: blocksToImport,
      chainSpec,
    });
    for (const block of reader) {
      logger.log(`📖 Importing block: #${block.header.view().timeSlotIndex.materialize()}`);
      importer.sendBlock(port, block.encoded().raw);
    }
    // close the importer.
    logger.info("All blocks scheduled to be imported.");
    return importer.finish(port);
  });
};

const initNetwork = async (
  importerReady: ImporterReady,
  workerConfig: WorkerConfig,
  genesisHeaderHash: HeaderHash,
  networkConfig: NetworkConfig | null,
  shouldStartNetwork: boolean,
  bestHeader: Listener<WithHash<HeaderHash, HeaderView>>,
) => {
  if (!shouldStartNetwork || networkConfig === null) {
    logger.log(`🛜 Networking off: ${networkConfig === null ? "no config" : "disabled"}`);
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
