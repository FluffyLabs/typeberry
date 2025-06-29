import { isMainThread, parentPort } from "node:worker_threads";

import { setTimeout } from "node:timers/promises";
import { MessageChannelStateMachine } from "@typeberry/state-machine";

import { LmdbBlocks, LmdbStates } from "@typeberry/database-lmdb";
import { LmdbRoot } from "@typeberry/database-lmdb/root.js";
import { type Finished, spawnWorkerGeneric } from "@typeberry/generic-worker";
import { keccak } from "@typeberry/hash";
import { Level, Logger } from "@typeberry/logger";
import { Generator } from "./generator.js";
import {
  type GeneratorInit,
  type GeneratorReady,
  type GeneratorStates,
  MainReady,
  generatorStateMachine,
} from "./state-machine.js";

const logger = Logger.new(import.meta.filename, "block-generator");

if (!isMainThread) {
  Logger.configureAll(process.env.JAM_LOG ?? "", Level.LOG);
  const machine = generatorStateMachine();
  const channel = MessageChannelStateMachine.receiveChannel(machine, parentPort);
  channel
    .then((channel) => main(channel))
    .catch((e) => {
      logger.error(e);
      if (e.stack !== undefined) {
        logger.error(e.stack);
      }
      if (e.cause !== undefined) {
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
  const lmdb = new LmdbRoot(config.dbPath);
  const blocks = new LmdbBlocks(config.chainSpec, lmdb);
  const states = new LmdbStates(config.chainSpec, lmdb);

  // Generate blocks until the close signal is received.
  const finished = await ready.doUntil<Finished>("finished", async (worker, port, isFinished) => {
    let counter = 0;
    const generator = new Generator(config.chainSpec, await keccak.KeccakHasher.create(), blocks, states);
    while (!isFinished()) {
      await setTimeout(6000);
      counter += 1;
      const newBlock = await generator.nextEncodedBlock();
      logger.trace(`Sending block ${counter}`);
      // TODO [ToDr] fix crashing!
      worker.sendBlock(port, newBlock);
    }
  });

  logger.info("Block Generator finished. Closing channel.");

  // Close the comms to gracefully close the app.
  finished.currentState().close(channel);
}

export async function spawnWorker() {
  return spawnWorkerGeneric(new URL("./bootstrap.mjs", import.meta.url), logger, "ready(main)", new MainReady());
}
