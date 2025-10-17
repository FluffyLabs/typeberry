import { parseBootnode } from "@typeberry/config-node";
import { ed25519, initWasm } from "@typeberry/crypto";
import { setup } from "@typeberry/jamnp-s";
import { Logger } from "@typeberry/logger";
import type { WorkerConfig } from "@typeberry/workers-api";
import type { NetworkingConfig, NetworkingInternal } from "./protocol.js";

const logger = Logger.new(import.meta.filename, "net");

/**
 * JAM networking worker.
 *
 * The worker is responsible for setting up the UDP networking socket
 * (using `typeberry/networking` package) and adding relevant JAMNP-s
 * stream handlers.
 */
export async function main(config: WorkerConfig<NetworkingConfig>, comms: NetworkingInternal) {
  await initWasm();
  logger.trace`🛜 Network starting`;

  // Await the configuration object
  const chainSpec = config.chainSpec;
  const db = config.openDatabase();
  const blocks = db.getBlocksDb();
  const params = config.workerParams;
  const key = await ed25519.privateKey(params.key);

  logger.info`🛜 Listening at ${params.host}:${params.port}`;
  const network = await setup(
    {
      host: params.host,
      port: params.port,
    },
    params.genesisHeaderHash,
    key,
    params.bootnodes.map(parseBootnode).filter((node) => node.host !== params.host || node.port !== params.port),
    chainSpec,
    blocks,
    async (blocks) => await comms.sendBlocks(blocks),
  );

  const waitForFinish = new Promise<void>((resolve) => {
    comms.setOnFinish(async () => resolve());
  });

  // send notifications about imported headers
  comms.setOnNewHeader(async (header) => {
    network.syncTask.broadcastHeader(header);
  });

  await network.network.start();

  // stop the network when the worker is finishing.
  await waitForFinish;
  await network.network.stop();
  await db.close();

  logger.info`🛜 Network worker finished. Closing channel.`;
}
