import { resolve } from "node:path";
import { Worker, isMainThread, parentPort } from "node:worker_threads";

import { MessageChannelStateMachine } from "@typeberry/state-machine";

import { Block } from "@typeberry/block";
import { tinyChainSpec } from "@typeberry/block/context";
import { Decoder } from "@typeberry/codec";
import { Logger } from "@typeberry/logger";
import { Generator } from "./generator";
import {
  type Finished,
  type WorkerInitialized,
  type WorkerReady,
  type WorkerStates,
  stateMachineMain,
  stateMachineWorker,
} from "./state-machine";

const logger = Logger.new(__filename, "block-generator");

if (!isMainThread) {
  const machine = stateMachineWorker();
  const channel = MessageChannelStateMachine.receiveChannel(machine, parentPort);
  channel.then((channel) => main(channel)).catch((e) => logger.error(e));
}

/**
 * The `BlockGenerator` should periodically create new blocks and send them as signals to the main thread.
 */
export async function main(channel: MessageChannelStateMachine<WorkerInitialized, WorkerStates>) {
  logger.info(`Worker running ${channel.currentState()}`);
  // Await the configuration object
  const ready = await channel.waitForState<WorkerReady>("ready(worker)");

  // Generate blocks until the close signal is received.
  const finished = await ready.doUntil<Finished>("finished", async (worker, port, isFinished) => {
    let counter = 0;
    const generator = new Generator(tinyChainSpec);
    while (!isFinished()) {
      counter += 1;
      const newBlock = await generator.nextEncodedBlock();
      Decoder.decodeObject(Block.Codec, newBlock, tinyChainSpec);
      worker.sendBlock(port, newBlock);
      await wait(3000);
    }
  });

  logger.info("Worker finished. Closing channel.");

  // Close the comms to gracefuly close the app.
  finished.currentState().close(channel);
}

export async function spawnWorker() {
  const worker = new Worker(resolve(__dirname, "./bootstrap.js"));

  const machine = stateMachineMain();
  const channel = await MessageChannelStateMachine.createAndTransferChannel(machine, worker);
  logger.info(`Worker spawned ${channel.currentState()}`);
  return channel;
}

async function wait(time_ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, time_ms);
  });
}
