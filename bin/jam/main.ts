import { isMainThread } from "node:worker_threads";
import { Logger } from "@typeberry/logger";

import { type ChainSpec, Config, fullChainSpec, tinyChainSpec } from "@typeberry/config";
import type { Finished, MainInit } from "@typeberry/generic-worker";
import * as blockImporter from "@typeberry/importer";
import type { MainReady } from "@typeberry/importer/state-machine";
import type { MessageChannelStateMachine } from "@typeberry/state-machine";
import { startBlockGenerator } from "./author";
import { initializeExtensions } from "./extensions";
import { startBlocksReader } from "./reader";

const logger = Logger.new(__filename, "jam");

/** Chain spec chooser. */
export enum KnownChainSpec {
  Tiny = "tiny",
  Full = "full",
}

/** General options. */
type Options = {
  /** Whether we should be authoring blocks. */
  isAuthoring: boolean;
  /** FS paths to blocks to import (ordered). */
  blocksToImport?: string[];
  /** Chain spec (could also be filename?) */
  chainSpec: KnownChainSpec;
};

export async function main(files?: string[]) {
  if (!isMainThread) {
    logger.error("The main binary cannot be running as a Worker!");
    return;
  }

  const options: Options = {
    isAuthoring: false,
    blocksToImport: files,
    chainSpec: KnownChainSpec.Tiny,
  };

  // General:
  // 1. Read the state from the State DB.
  // 2. Read the latest block from the Blocks DB.
  // 3. If we don't have any data, start with genesis state (read from JSON/BIN? - what format?)
  //
  // Authorship:
  // 1. load validator keys (bandersnatch, ed25519, bls)
  // 2. allow the validator to specify metadata.
  // 3. if we have validator keys, we should start the authorship module.
  //
  // After setup:
  // 1. wait for blocks:
  // 1.1. Either from networking
  // 1.2. CLI (JSON/BIN?)
  // 1.3. List of JSON/BIN files?
  const importerInit = await blockImporter.spawnWorker();
  const bestHeader = importerInit.getState<MainReady>("ready(main)").onBestBlock;
  const closeExtensions = initializeExtensions({ bestHeader });

  // start block importer
  const chainSpec = getChainSpec(options.chainSpec);
  const config = new Config(chainSpec, "blocks-db");
  const importerReady = importerInit.transition((state, port) => {
    return state.sendConfig(port, config);
  });

  // initialize block reader and wait for it to finish
  await initBlocksReader(importerReady, chainSpec, options.blocksToImport);

  // Authorship initialization.
  const closeAuthorship = await (options.isAuthoring
    ? (async () => {
        logger.info("✍️  Starting block generator.");
        const { generator, finish } = await startBlockGenerator(config);
        // relay blocks from generator to importer
        importerReady.doUntil<Finished>("finished", async (importer, port) => {
          generator.currentState().onBlock.on((b) => {
            logger.log(`✍️  Produced block: ${b.length}`);
            importer.sendBlock(port, b);
          });
        });

        return finish;
      })()
    : noop);

  // start regular operation
  const whenImporterDone = importerReady.doUntil<Finished>("finished", async () => {});

  logger.log("[main]⌛ waiting for tasks to finish");
  const importerDone = await whenImporterDone;
  await importerDone.currentState().waitForWorkerToFinish();
  logger.log("[main] ☠️  Closing the authorship module");
  closeAuthorship();
  logger.log("[main] ☠️  Closing the extensions");
  closeExtensions();
  logger.info("[main] ✅ Done.");
}

const initBlocksReader = async (
  importerReady: MessageChannelStateMachine<MainReady, Finished | MainReady | MainInit<MainReady>>,
  chainSpec: ChainSpec,
  blocksToImport?: string[],
) => {
  if (blocksToImport !== undefined) {
    logger.info(`📖 Reading ${blocksToImport.length} blocks`);
    return new Promise((resolve, reject) => {
      importerReady.doUntil<Finished>("finished", async (importer, port) => {
        try {
          const reader = startBlocksReader({
            files: blocksToImport,
            chainSpec,
          });
          for (const block of reader) {
            logger.log(`📖 Importing block: #${block.header.view().timeSlotIndex.materialize()}`);
            importer.sendBlock(port, block.encoded().raw);
          }
          return resolve(null);
        } catch (e) {
          return reject(e);
        }
      });
    });
  }

  return Promise.resolve();
};

const noop = () => Promise.resolve();

const getChainSpec = (name: KnownChainSpec) => {
  if (name === KnownChainSpec.Full) {
    return fullChainSpec;
  }

  if (name === KnownChainSpec.Tiny) {
    return tinyChainSpec;
  }

  throw new Error(`Unknown chain spec: ${name}`);
};
