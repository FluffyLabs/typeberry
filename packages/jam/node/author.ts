import * as blockGenerator from "@typeberry/block-generator";
import type { WorkerConfig } from "@typeberry/config";

export async function startBlockGenerator(config: WorkerConfig) {
  const generatorInit = await blockGenerator.spawnWorker();

  const generatorReady = generatorInit.transition((state, port) => {
    return state.sendConfig(port, config);
  });

  return {
    generator: generatorReady,
    finish: () => {
      // Send a finish signal to the block generator.
      generatorReady.transition((ready, port) => {
        return ready.finish(port);
      });
      return generatorReady.waitForState("finished");
    },
  };
}
