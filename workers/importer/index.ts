import { isMainThread, parentPort } from "node:worker_threads";

import { MessageChannelStateMachine } from "@typeberry/state-machine";

import { InMemoryKvdb, StateDb } from "@typeberry/database";
import { LmdbBlocks } from "@typeberry/database-lmdb";
import { type Finished, spawnWorkerGeneric } from "@typeberry/generic-worker";
import { SimpleAllocator, keccak } from "@typeberry/hash";
import { Level, Logger } from "@typeberry/logger";
import { TransitionHasher } from "@typeberry/transition";
import { Importer } from "./importer";
import {
  type ImporterInit,
  type ImporterReady,
  type ImporterStates,
  MainReady,
  importerStateMachine,
} from "./state-machine";

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
  logger.info(`Importer running ${channel.currentState()}`);
  // Await the configuration object
  const ready = await channel.waitForState<ImporterReady>("ready(importer)");

  const finished = await ready.doUntil<Finished>("finished", async (worker, port) => {
    logger.info("Importer waiting for blocks.");
    const config = worker.getConfig();
    const importer = new Importer(
      new LmdbBlocks(config.chainSpec, config.blocksDbPath),
      new StateDb(config.chainSpec, new InMemoryKvdb()),
      config.chainSpec,
      new TransitionHasher(config.chainSpec, await keccakHasher, new SimpleAllocator()),
    );

    // TODO [ToDr] back pressure?
    worker.onBlock.on(async (b) => {
      logger.log(`🧊 Got block: ${b.header.view().timeSlotIndex.materialize()}`);
      const bestHeader = await importer.importBlock(b);

      worker.announce(port, bestHeader);
      logger.info(`🧊 Best block: ${bestHeader.hash}`);
    });
  });

  logger.info("Importer finished. Closing channel.");

  // Close the comms to gracefuly close the app.
  finished.currentState().close(channel);
}

export async function spawnWorker() {
  return spawnWorkerGeneric(__dirname, logger, "ready(main)", new MainReady());
}
