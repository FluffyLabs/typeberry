import { isMainThread, parentPort } from "node:worker_threads";

import { initWasm } from "@typeberry/crypto";
import { LmdbBlocks, LmdbRoot, LmdbStates } from "@typeberry/database-lmdb";
import type { Finished } from "@typeberry/generic-worker";
import { keccak, SimpleAllocator } from "@typeberry/hash";
import { Level, Logger } from "@typeberry/logger";
import { MessageChannelStateMachine } from "@typeberry/state-machine";
import { TransitionHasher } from "@typeberry/transition";
import { measure, resultToString } from "@typeberry/utils";
import { ImportQueue } from "./import-queue.js";
import { Importer } from "./importer.js";
import { type ImporterInit, type ImporterReady, type ImporterStates, importerStateMachine } from "./state-machine.js";

const logger = Logger.new(import.meta.filename, "importer");

if (!isMainThread) {
  Logger.configureAll(process.env.JAM_LOG ?? "", Level.LOG);
  const machine = importerStateMachine();
  const channel = MessageChannelStateMachine.receiveChannel(machine, parentPort);
  channel.then((channel) => main(channel)).catch((e) => logger.error(e));
}

const keccakHasher = keccak.KeccakHasher.create();

/**
 * The `BlockImporter` listens to `block` signals, where it expects
 * RAW undecoded block objects (typically coming from the network).
 *
 * These blocks should be decoded, verified and later imported.
 */
export async function main(channel: MessageChannelStateMachine<ImporterInit, ImporterStates>) {
  const wasmPromise = initWasm();
  logger.info(`📥 Importer starting ${channel.currentState()}`);
  // Await the configuration object
  const ready = await channel.waitForState<ImporterReady>("ready(importer)");

  const finished = await ready.doUntil<Finished>("finished", async (worker, port) => {
    const config = worker.getConfig();
    const lmdb = new LmdbRoot(config.dbPath);
    const blocks = new LmdbBlocks(config.chainSpec, lmdb);
    const states = new LmdbStates(config.chainSpec, lmdb);
    const hasher = new TransitionHasher(config.chainSpec, await keccakHasher, new SimpleAllocator());
    const importer = new Importer(config.chainSpec, hasher, logger, blocks, states);
    // TODO [ToDr] this is shit, since we have circular dependency.
    worker.setImporter(importer);
    logger.info("📥 Importer waiting for blocks.");

    // TODO [ToDr] back pressure?
    let isProcessing = false;
    const importingQueue = new ImportQueue(config.chainSpec, importer);

    worker.onBlock.on(async (block) => {
      const details = ImportQueue.getBlockDetails(block);
      // ignore invalid blocks.
      if (details.isError) {
        logger.trace("🧊 Ignoring invalid block.");
        return;
      }

      // ignore already known blocks
      if (blocks.getHeader(details.ok.hash) !== null) {
        logger.trace(`🧊 Already imported block: #${details.ok.data.timeSlot}.`);
        return;
      }

      const importResult = importingQueue.push(details.ok);
      // ignore blocks that are already queued
      if (importResult.isError) {
        logger.trace(`🧊 Already queued block: #${details.ok.data.timeSlot}.`);
        return;
      }

      logger.log(`🧊 Queued block: #${details.ok.data.timeSlot} (skip seal: ${config.omitSealVerification})`);

      if (isProcessing) {
        return;
      }

      isProcessing = true;
      try {
        for (;;) {
          const entry = importingQueue.shift();
          if (entry === undefined) {
            return;
          }
          const { block, seal, timeSlot } = entry;
          const timer = measure("importBlock");
          const maybeBestHeader = await importer.importBlock(block, await seal, config.omitSealVerification);
          if (maybeBestHeader.isOk) {
            const bestHeader = maybeBestHeader.ok;
            worker.announce(port, bestHeader);
            logger.info(`🧊 Best block: #${bestHeader.data.timeSlotIndex.materialize()} (${bestHeader.hash})`);
          } else {
            logger.log(`❌ Rejected block #${timeSlot}: ${resultToString(maybeBestHeader)}`);
          }
          logger.log(timer());
        }
      } finally {
        isProcessing = false;
      }
    });

    await wasmPromise;
  });

  logger.info("📥 Importer finished. Closing channel.");

  // Close the comms to gracefuly close the app.
  finished.currentState().close(channel);
}
