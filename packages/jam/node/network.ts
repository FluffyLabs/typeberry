import * as jamNetwork from "@typeberry/jam-network";
import type { NetworkWorkerConfig } from "@typeberry/jam-network/state-machine.js";

export async function startNetwork(config: NetworkWorkerConfig) {
  const networkInit = await jamNetwork.spawnWorker();

  const networkReady = networkInit.transition((state, port) => {
    return state.sendConfig(port, config);
  });

  return {
    network: networkReady,
    finish: () => {
      // Send a finish signal to the network
      networkReady.transition((ready, port) => {
        return ready.finish(port);
      });
      return networkReady.waitForState("finished");
    },
  };
}
