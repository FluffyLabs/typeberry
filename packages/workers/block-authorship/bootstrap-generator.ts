import { AUTHORSHIP_NETWORK_PORT, protocol as networkProtocol } from "@typeberry/comms-authorship-network";
import { Logger } from "@typeberry/logger";
import { Telemetry } from "@typeberry/telemetry";
import { Channel } from "@typeberry/workers-api";
import { initWorker } from "@typeberry/workers-api-node";
import { main } from "./main.js";
import { BlockAuthorshipConfig, protocol as mainProtocol } from "./protocol.js";

const logger = Logger.new(import.meta.filename, "block-authorship/bootstrap");

// `.then` instead of top-level `await`: bun's parentPort stops delivering messages while the worker module is suspended on top-level await.
initWorker(mainProtocol, BlockAuthorshipConfig.Codec)
  .then(async ({ config, comms }) => {
    const tele = Telemetry.initialize({
      worker: "generator",
      nodeName: config.nodeName,
    });

    const port = config.ports.get(AUTHORSHIP_NETWORK_PORT);
    if (port === undefined) {
      throw new Error("Network port not found in config");
    }
    const networkingComms = Channel.tx(networkProtocol, port);
    await main(config, comms, networkingComms);
    await tele?.close();
    process.exit(0);
  })
  .catch((e) => {
    logger.error`block-authorship worker failed: ${e}`;
    process.exit(1);
  });
