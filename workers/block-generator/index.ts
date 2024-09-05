import { resolve } from "node:path";
import { Worker, isMainThread, parentPort } from "node:worker_threads";

import { MessageChannelStateMachine } from "@typeberry/state-machine";

import { newLogger } from "@typeberry/logger";
import {
  type Finished,
  type WorkerInitialized,
  type WorkerReady,
  type WorkerStates,
  stateMachineMain,
  stateMachineWorker,
} from "./state-machine";

const logger = newLogger(__filename, "block-generator");

if (!isMainThread) {
  const machine = stateMachineWorker();
  const channel = MessageChannelStateMachine.receiveChannel(machine, parentPort);
  channel.then((channel) => main(channel)).catch(logger.error);
}

/**
 * The `BlockGenerator` should periodically create new blocks and send them as signals to the main thread.
 */
export async function main(channel: MessageChannelStateMachine<WorkerInitialized, WorkerStates>) {
  logger.log(`Worker running ${channel.currentState()}`);
  // Await the configuration object
  const ready = await channel.waitForState<WorkerReady>("ready(worker)");

  // Generate blocks until the close signal is received.
  const finished = await ready.doUntil<Finished>("finished", async (worker, port, isFinished) => {
    let counter = 0;
    while (!isFinished()) {
      counter += 1;
      worker.sendBlock(port, { number: counter });
      await wait(3000);
    }
  });

  logger.log("Worker finished. Closing channel.");

  // Close the comms to gracefuly close the app.
  finished.currentState().close(channel);
}

export async function spawnWorker() {
  const worker = new Worker(resolve(__dirname, "./bootstrap.js"));

  const machine = stateMachineMain();
  const channel = await MessageChannelStateMachine.createAndTransferChannel(machine, worker);
  logger.log(`Worker spawned ${channel.currentState()}`);
  return channel;
}

async function wait(time_ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, time_ms);
  });
}
