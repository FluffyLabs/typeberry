import { isMainThread, parentPort } from "node:worker_threads";

import { MessageChannelStateMachine } from "@typeberry/state-machine";

import { Bytes } from "@typeberry/bytes";
import { parseBootnode } from "@typeberry/config-node";
import { ED25519_PRIV_KEY_BYTES, ed25519 } from "@typeberry/crypto";
import { LmdbBlocks } from "@typeberry/database-lmdb";
import { LmdbRoot } from "@typeberry/database-lmdb";
import { type Finished, spawnWorkerGeneric } from "@typeberry/generic-worker";
import { setup } from "@typeberry/jamnp-s";
import { Level, Logger } from "@typeberry/logger";
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
 * TODO [ToDr] Docs
 */
export async function main(channel: MessageChannelStateMachine<NetworkInit, NetworkStates>) {
  logger.trace(`🛜 Network starting ${channel.currentState()}`);
  // Await the configuration object
  const ready = await channel.waitForState<NetworkReady>("ready(network)");

  const finished = await ready.doUntil<Finished>("finished", async (worker, port) => {
    const config = worker.getConfig();
    const key = await ed25519.privateKey(Bytes.parseBytes(config.key, ED25519_PRIV_KEY_BYTES));

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

    // stop the network when the worker is finishing.
    ready.waitForState("finished").then(() => network.network.stop());

    await network.network.start();
  });

  logger.info("🛜 Network worker finished. Closing channel.");

  // Close the comms to gracefuly close the app.
  finished.currentState().close(channel);
}

export async function spawnWorker() {
  return spawnWorkerGeneric(new URL("./bootstrap.mjs", import.meta.url), logger, "ready(main)", new MainReady());
}
