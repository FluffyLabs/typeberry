import { isMainThread, parentPort } from "node:worker_threads";

import { setTimeout } from "node:timers/promises";
import { MessageChannelStateMachine } from "@typeberry/state-machine";

import { LmdbBlocks } from "@typeberry/database-lmdb";
import { type Finished, spawnWorkerGeneric } from "@typeberry/generic-worker";
import { Level, Logger } from "@typeberry/logger";
import { Generator } from "./generator";
import {
  type GeneratorInit,
  type GeneratorReady,
  type GeneratorStates,
  MainReady,
  generatorStateMachine,
} from "./state-machine";

const logger = Logger.new(__filename, "block-generator");

if (!isMainThread) {
  Logger.configureAll(process.env.JAM_LOG ?? "", Level.LOG);
  const machine = generatorStateMachine();
  const channel = MessageChannelStateMachine.receiveChannel(machine, parentPort);
  channel
    .then((channel) => main(channel))
    .catch((e) => {
      logger.error(e);
      if (e.stack) {
        logger.error(e.stack);
      }
      if (e.cause) {
        logger.error(e.cause);
      }
    });
}

/**
 * The `BlockGenerator` should periodically create new blocks and send them as signals to the main thread.
 */
export async function main(channel: MessageChannelStateMachine<GeneratorInit, GeneratorStates>) {
  logger.info(`Block Generator running ${channel.currentState()}`);
  // Await the configuration object
  const ready = await channel.waitForState<GeneratorReady>("ready(generator)");
  const config = ready.currentState().getConfig();
  const blocks = new LmdbBlocks(config.chainSpec, config.blocksDbPath);

  // Generate blocks until the close signal is received.
  const finished = await ready.doUntil<Finished>("finished", async (worker, port, isFinished) => {
    let counter = 0;
    const generator = new Generator(config.chainSpec, blocks);
    while (!isFinished()) {
      counter += 1;
      const newBlock = await generator.nextEncodedBlock();
      logger.trace(`Sending block ${counter}`);
      worker.sendBlock(port, newBlock);
      await setTimeout(3000);
    }
  });

  logger.info("Block Generator finished. Closing channel.");

  // Close the comms to gracefuly close the app.
  finished.currentState().close(channel);
}

export async function spawnWorker() {
  return spawnWorkerGeneric(__dirname, logger, "ready(main)", new MainReady());
}
