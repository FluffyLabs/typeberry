import { isMainThread } from "node:worker_threads";

import * as blockGenerator from "@typeberry/block-generator";

async function main() {
  if (isMainThread) {
    const worker = await blockGenerator.spawnWorker();
    const blockGen = worker.transition((state, port) => {
      return state.sendConfig(port, {
        queueSize: 2,
      });
    });

    await wait(10000);

    const finished = blockGen.transition((ready, port) => {
      return ready.finish(port);
    });

    console.log('[main] waiting for tasks to finish');
    await finished.currentState().waitForWorkerToFinish();

  } else {
    console.error("The main binary cannot be running as a Worker!");
    return;
  }
}

main();

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

