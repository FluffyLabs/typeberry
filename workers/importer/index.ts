import { isMainThread, parentPort } from "node:worker_threads";

import { MessageChannelStateMachine } from "@typeberry/state-machine";

import { type Finished, spawnWorkerGeneric } from "@typeberry/generic-worker";
import { SimpleAllocator } from "@typeberry/hash";
import { Level, Logger } from "@typeberry/logger";
import { TransitionHasher } from "../../packages/transition";
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

  const finished = await ready.doUntil<Finished>("finished", async (worker) => {
    logger.info("Importer waiting for blocks.");
    const importer = new Importer(new TransitionHasher(worker.getChainSpec(), new SimpleAllocator()));

    worker.onBlock.on((b) => {
      logger.info(`Got block: ${b.header}`);
      importer.importBlock(b);

      logger.info(`Best block: ${importer.bestBlockHeader()}`);
    });
  });

  logger.info("Importer finished. Closing channel.");

  // Close the comms to gracefuly close the app.
  finished.currentState().close(channel);
}

export async function spawnWorker() {
  return spawnWorkerGeneric(__dirname, logger, "ready(main)", new MainReady());
}
