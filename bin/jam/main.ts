import { isMainThread } from "node:worker_threads";
import { Logger } from "@typeberry/logger";

import * as blockGenerator from "@typeberry/block-generator";
import { tinyChainSpec } from "@typeberry/block/context";
import type { Finished } from "@typeberry/generic-worker";
import * as blockImporter from "@typeberry/importer";

const logger = Logger.new(__filename, "jam");

export async function main() {
  if (isMainThread) {
    const generatorInit = await blockGenerator.spawnWorker();
    const importerInit = await blockImporter.spawnWorker();

    // initialize both workers
    const generatorReady = generatorInit.transition((state, port) => {
      return state.sendConfig(port, tinyChainSpec);
    });
    const importerReady = importerInit.transition((state, port) => {
      return state.sendConfig(port, tinyChainSpec);
    });

    // relay blocks from generator to importer
    const whenImporterDone = importerReady.doUntil<Finished>("finished", async (importer, port) => {
      generatorReady
        .currentState()
        .onBlock.on((b) => {
          logger.log(`Relaying block: ${b.length}`);
          importer.sendBlock(port, b);
        })
        .onceDone(() => {
          // send finish signal to the importer if the generator is done
          importer.finish(port);
        });
    });

    // Just a dummy timer, to give some time to generate blocks.
    await wait(10000);

    // Send a finish signal to the block generator.
    const generatorFinished = generatorReady.transition((ready, port) => {
      return ready.finish(port);
    });

    logger.log("[main] waiting for tasks to finish");
    await generatorFinished.currentState().waitForWorkerToFinish();
    const importerDone = await whenImporterDone;
    await importerDone.currentState().waitForWorkerToFinish();
  } else {
    logger.error("The main binary cannot be running as a Worker!");
    return;
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
