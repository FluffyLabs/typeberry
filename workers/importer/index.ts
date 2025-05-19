import { isMainThread, parentPort } from "node:worker_threads";

import { MessageChannelStateMachine } from "@typeberry/state-machine";

import { LmdbBlocks, LmdbStates } from "@typeberry/database-lmdb";
import { LmdbRoot } from "@typeberry/database-lmdb";
import { type Finished, spawnWorkerGeneric } from "@typeberry/generic-worker";
import { SimpleAllocator, keccak } from "@typeberry/hash";
import { Level, Logger } from "@typeberry/logger";
import { TransitionHasher } from "@typeberry/transition";
import { resultToString } from "@typeberry/utils";
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
      blocks,
      states,
      config.chainSpec,
      new TransitionHasher(config.chainSpec, await keccakHasher, new SimpleAllocator()),
      logger,
    );

    // TODO [ToDr] back pressure?
    worker.onBlock.on(async (b) => {
      // NOTE [ToDr] this is incorrect, since it may fail to decode.
      const timeSlot = b.header.view().timeSlotIndex.materialize();
      logger.log(`🧊 Got block: #${timeSlot}`);
      const maybeBestHeader = await importer.importBlock(b);
      if (maybeBestHeader.isOk) {
        const bestHeader = maybeBestHeader.ok;
        worker.announce(port, bestHeader);
        logger.info(`🧊 Best block: #${bestHeader.data.timeSlotIndex.materialize()} (${bestHeader.hash})`);
      } else {
        logger.error(`❌ Rejected block #${timeSlot}: ${resultToString(maybeBestHeader)}`);
      }
    });
  });

  logger.info("📥 Importer finished. Closing channel.");

  // Close the comms to gracefuly close the app.
  finished.currentState().close(channel);
}

export async function spawnWorker() {
  return spawnWorkerGeneric(new URL(import.meta.resolve("./bootstrap.cjs")), logger, "ready(main)", new MainReady());
}
