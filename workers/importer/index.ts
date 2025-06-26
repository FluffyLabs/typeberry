import { isMainThread, parentPort } from "node:worker_threads";

import { MessageChannelStateMachine } from "@typeberry/state-machine";

import { tryAsTimeSlot } from "@typeberry/block";
import { LmdbBlocks, LmdbStates } from "@typeberry/database-lmdb";
import { LmdbRoot } from "@typeberry/database-lmdb";
import { type Finished, spawnWorkerGeneric } from "@typeberry/generic-worker";
import { SimpleAllocator, keccak } from "@typeberry/hash";
import { Level, Logger } from "@typeberry/logger";
import { TransitionHasher } from "@typeberry/transition";
import { measure, resultToString } from "@typeberry/utils";
import { ImportQueue } from "./import-queue.js";
import { Importer } from "./importer.js";
import {
  type ImporterInit,
  type ImporterReady,
  type ImporterStates,
  MainReady,
  importerStateMachine,
} from "./state-machine.js";

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
  logger.info(`📥 Importer starting ${channel.currentState()}`);
  // Await the configuration object
  const ready = await channel.waitForState<ImporterReady>("ready(importer)");

  const finished = await ready.doUntil<Finished>("finished", async (worker, port) => {
    logger.info("📥 Importer waiting for blocks.");
    const config = worker.getConfig();
    const lmdb = new LmdbRoot(config.dbPath);
    const blocks = new LmdbBlocks(config.chainSpec, lmdb);
    const states = new LmdbStates(config.chainSpec, lmdb);
    const importer = new Importer(
      config.chainSpec,
      new TransitionHasher(config.chainSpec, await keccakHasher, new SimpleAllocator()),
      logger,
      blocks,
      states,
    );

    // TODO [ToDr] back pressure?
    let isProcessing = false;
    const importingQueue = new ImportQueue(config.chainSpec, importer);

    worker.onBlock.on(async (block) => {
      const newBlockSlot = importingQueue.push(block) ?? tryAsTimeSlot(0);
      logger.log(`🧊 Got block: #${newBlockSlot}`);

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
          const maybeBestHeader = await importer.importBlock(block, await seal, config.typeberryMode);
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
  });

  logger.info("📥 Importer finished. Closing channel.");

  // Close the comms to gracefuly close the app.
  finished.currentState().close(channel);
}

export async function spawnWorker() {
  return spawnWorkerGeneric(new URL("./bootstrap.mjs", import.meta.url), logger, "ready(main)", new MainReady());
}
