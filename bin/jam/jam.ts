import { isMainThread } from "node:worker_threads";
import { Logger } from "@typeberry/logger";

import * as blockGenerator from "@typeberry/block-generator";

const logger = Logger.new(__filename, "jam");

export async function main() {
  if (isMainThread) {
    const worker = await blockGenerator.spawnWorker();
    const blockGen = worker.transition((state, port) => {
      return state.sendConfig(port, {
        queueSize: 2,
      });
    });

    // Just a dummy timer, to give some time to generate blocks.
    await wait(10000);

    // Send a finish signal to the block generator.
    const finished = blockGen.transition((ready, port) => {
      return ready.finish(port);
    });

    logger.log("[main] waiting for tasks to finish");
    await finished.currentState().waitForWorkerToFinish();
  } else {
    logger.error("The main binary cannot be running as a Worker!");
    return;
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
