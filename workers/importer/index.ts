import { isMainThread, parentPort } from "node:worker_threads";

import { MessageChannelStateMachine } from "@typeberry/state-machine";

import { LmdbBlocks, LmdbStates } from "@typeberry/database-lmdb";
import { LmdbRoot } from "@typeberry/database-lmdb";
import { type Finished, spawnWorkerGeneric } from "@typeberry/generic-worker";
import { SimpleAllocator, keccak } from "@typeberry/hash";
import { Level, Logger } from "@typeberry/logger";
import { TransitionHasher } from "@typeberry/transition";
import { resultToString } from "@typeberry/utils";
import { Importer } from "./importer";
import {
  type ImporterInit,
  type ImporterReady,
  type ImporterStates,
  MainReady,
  importerStateMachine,
} from "./state-machine";
import {BlockView} from "@typeberry/block";

const logger = Logger.new(__filename, "importer");

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
      blocks,
      states,
      config.chainSpec,
      new TransitionHasher(config.chainSpec, await keccakHasher, new SimpleAllocator()),
      logger,
    );

    // TODO [ToDr] back pressure?
    let isProcessing = false;
    const importingQueue: BlockView[] = [];

    worker.onBlock.on(async (b) => {
      importingQueue.push(b);
      // NOTE [ToDr] this is incorrect, since it may fail to decode.
      const timeSlot = b.header.view().timeSlotIndex.materialize();
      logger.log(`🧊 Got block: #${timeSlot}`);

      if (isProcessing) {
        // some other annoncement is already processing the import queue.
        return;
      }

      isProcessing = true;
      try {
        while (importingQueue.length > 0) {
          const b = importingQueue.shift();
          if (!b) {
            return;
          }
          console.time('importBlock');
          const maybeBestHeader = await importer.importBlock(b);
          if (maybeBestHeader.isOk) {
            const bestHeader = maybeBestHeader.ok;
            worker.announce(port, bestHeader);
            logger.info(`🧊 Best block: #${bestHeader.data.timeSlotIndex.materialize()} (${bestHeader.hash})`);
          } else {
            logger.log(`❌ Rejected block #${timeSlot}: ${resultToString(maybeBestHeader)}`);
          }
          console.timeEnd('importBlock');
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
  return spawnWorkerGeneric(__dirname, logger, "ready(main)", new MainReady());
}
