import { isMainThread, parentPort } from "node:worker_threads";

import { parseBootnode } from "@typeberry/config-node";
import { ed25519 } from "@typeberry/crypto";
import { LmdbBlocks } from "@typeberry/database-lmdb";
import { LmdbRoot } from "@typeberry/database-lmdb";
import { type Finished, spawnWorkerGeneric } from "@typeberry/generic-worker";
import { setup } from "@typeberry/jamnp-s";
import { Level, Logger } from "@typeberry/logger";
import { MessageChannelStateMachine } from "@typeberry/state-machine";
import {
  MainReady,
  type NetworkInit,
  type NetworkReady,
  type NetworkStates,
  networkStateMachine,
} from "./state-machine.js";

const logger = Logger.new(import.meta.filename, "net");

if (!isMainThread) {
  Logger.configureAll(process.env.JAM_LOG ?? "", Level.LOG);
  const machine = networkStateMachine();
  const channel = MessageChannelStateMachine.receiveChannel(machine, parentPort);
  channel.then((channel) => main(channel)).catch((e) => logger.error(e));
}

/**
 * JAM networking worker.
 *
 * The worker is responsible for setting up the UDP networking socket
 * (using `typeberry/networking` package) and adding relevant JAMNP-s
 * stream handlers.
 */
export async function main(channel: MessageChannelStateMachine<NetworkInit, NetworkStates>) {
  logger.trace(`🛜 Network starting ${channel.currentState()}`);
  // Await the configuration object
  const ready = await channel.waitForState<NetworkReady>("ready(network)");

  const finished = await ready.doUntil<Finished>("finished", async (worker, port) => {
    const config = worker.getConfig();
    const key = await ed25519.privateKey(config.key);

    const lmdb = new LmdbRoot(config.genericConfig.dbPath);
    const blocks = new LmdbBlocks(config.genericConfig.chainSpec, lmdb);

    logger.info(`🛜 Listening at ${config.host}:${config.port}`);
    const network = await setup(
      {
        host: config.host,
        port: config.port,
      },
      config.genesisHeaderHash,
      key,
      config.bootnodes.map(parseBootnode).filter((node) => node.host !== config.host || node.port !== config.port),
      config.genericConfig.chainSpec,
      blocks,
      (blocks) => worker.sendBlocks(port, blocks),
    );

    // send notifications about imported headers
    worker.onNewHeader.on((header) => {
      network.syncTask.broadcastHeader(header);
    });

    // stop the network when the worker is finishing.
    ready.waitForState("finished").then(() => network.network.stop());

    await network.network.start();
  });

  logger.info("🛜 Network worker finished. Closing channel.");

  // Close the comms to gracefuly close the app.
  finished.currentState().close(channel);
}

const workerFile = new URL("./bootstrap-network.mjs", import.meta.url);

export async function spawnWorker() {
  return spawnWorkerGeneric(workerFile, logger, "ready(main)", new MainReady());
}
