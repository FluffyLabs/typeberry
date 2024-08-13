import { isMainThread } from "node:worker_threads";

import * as blockGenerator from "@typeberry/block-generator";

async function main() {
  if (isMainThread) {
    const generatorWorker = await blockGenerator.spawnWorker();
  } else {
    console.error("The main binary cannot be running as a Worker!");
    return;
  }
}

main();
