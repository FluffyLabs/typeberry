import { setTimeout } from "node:timers/promises";
import { isMainThread, parentPort } from "node:worker_threads";
import { LmdbBlocks, LmdbStates } from "@typeberry/database-lmdb";
import { LmdbRoot } from "@typeberry/database-lmdb/root.js";
import { type Finished, spawnWorkerGeneric } from "@typeberry/generic-worker";
import { Blake2b, keccak } from "@typeberry/hash";
import { Level, Logger } from "@typeberry/logger";
import { MessageChannelStateMachine } from "@typeberry/state-machine";
import { Generator } from "./generator.js";
import {
  type GeneratorInit,
  type GeneratorReady,
  type GeneratorStates,
  generatorStateMachine,
  MainReady,
} from "./state-machine.js";

const logger = Logger.new(import.meta.filename, "generator");

if (!isMainThread) {
  Logger.configureAll(process.env.JAM_LOG ?? "", Level.LOG);
  const machine = generatorStateMachine();
  const channel = MessageChannelStateMachine.receiveChannel(machine, parentPort);
  channel
    .then((channel) => main(channel))
    .catch((e) => {
      logger.error`${e}`;
      if (e.stack !== undefined) {
        logger.error`${e.stack}`;
      }
      if (e.cause !== undefined) {
        logger.error`${e.cause}`;
      }
    });
}

/**
 * The `BlockGenerator` should periodically create new blocks and send them as signals to the main thread.
 */
export async function main(channel: MessageChannelStateMachine<GeneratorInit, GeneratorStates>) {
  const blake2b = Blake2b.createHasher();
  logger.info`🎁 Block Generator running ${channel.currentState()}`;
  // Await the configuration object
  const ready = await channel.waitForState<GeneratorReady>("ready(generator)");
  const config = ready.currentState().getConfig();
  const lmdb = new LmdbRoot(config.dbPath);
  const blocks = new LmdbBlocks(config.chainSpec, lmdb);
  const states = new LmdbStates(config.chainSpec, await blake2b, lmdb);

  // Generate blocks until the close signal is received.
  const finished = await ready.doUntil<Finished>("finished", async (worker, port, isFinished) => {
    let counter = 0;
    const generator = new Generator(
      config.chainSpec,
      await keccak.KeccakHasher.create(),
      await Blake2b.createHasher(),
      blocks,
      states,
    );
    while (!isFinished()) {
      await setTimeout(config.chainSpec.slotDuration * 1000);
      counter += 1;
      const newBlock = await generator.nextEncodedBlock();
      logger.trace`Sending block ${counter}`;
      worker.sendBlock(port, newBlock);
    }
  });

  logger.info`Block Generator finished. Closing channel.`;

  // Close the comms to gracefully close the app.
  finished.currentState().close(channel);
}

const workerFile = new URL("./bootstrap-generator.mjs", import.meta.url);

export async function spawnWorker(customLogger?: Logger, customMainReady?: MainReady) {
  const workerLogger = customLogger ?? logger;
  const mainReady = customMainReady ?? new MainReady();
  return spawnWorkerGeneric(workerFile, workerLogger, "ready(main)", mainReady);
}
