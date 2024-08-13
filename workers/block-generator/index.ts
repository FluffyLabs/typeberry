import { isMainThread, parentPort, Worker, MessagePort, MessageChannel } from "node:worker_threads";
import { resolve } from 'node:path';
import {mainStateMachine} from "./state-machine";

if (!isMainThread) {
  parentPort?.once("message", (value) => {
    const channel = value.channel;
    main(channel);
  });
}

export async function spawnWorker() {

  const worker = new Worker(resolve(__dirname, './bootstrap.js'));

  const machine = mainStateMachine(worker);

  return machine.machine.waitForState('configuring');
    //
    // channel.port2.once("message", (msg) => {
    //   console.log("Got response", msg);
    //   resolve(channel.port2);
    // });
    //
    // worker.postMessage(
    //   {
    //     channel: channel.port1,
    //   },
    //   [channel.port1],
    // );
}

export function main(channel: MessagePort) {
  console.log("Block Generator worker initialized");
  channel.postMessage({
    name: "initialized",
    data: null,
  });
}
