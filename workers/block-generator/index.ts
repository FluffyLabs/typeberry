import { resolve } from "node:path";
import { Worker, isMainThread, parentPort } from "node:worker_threads";
import { stateMachineWorker, stateMachineMain, StatesWorker, ReadyWorker } from "./state-machine";
import {MessageChannelStateMachine} from "./state-machine/channel";

if (!isMainThread) {
  const machine = stateMachineWorker();
  const channel = MessageChannelStateMachine.receiveChannel(machine, parentPort)
  channel
    .then(channel => main(channel))
    .catch(console.error);
}

export async function spawnWorker() {
  const worker = new Worker(resolve(__dirname, "./bootstrap.js"));

  const machine = stateMachineMain();
  const channel = await MessageChannelStateMachine.createAndTransferChannel(machine, worker);
  console.log('[BlockGenerator] Worker spawned', channel.currentState().stateName);
  return channel;
}

export async function main(channel: MessageChannelStateMachine<InitializedWorker, StatesWorker>) {
  console.log("[BlockGenerator] Worker running", channel.currentState().stateName);
  const ready = await channel.waitForState<ReadyWorker>('ready(worker)');

  const finished = await ready.doUntil('finished', async (worker, port, isFinished) => {
    let counter = 0;
    while(!isFinished()) {
      counter += 1;
      worker.sendBlock(port, { number: counter });
      await wait(3000);
    }
  });

  console.log('[BlockGenerator] Worker finished. Closing channel.');

  channel.close();
}

async function wait(time_ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, time_ms);
  });
}
