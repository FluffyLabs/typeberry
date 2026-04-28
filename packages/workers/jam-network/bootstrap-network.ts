import { AUTHORSHIP_NETWORK_PORT, protocol as authorshipProtocol } from "@typeberry/comms-authorship-network";
import { Logger } from "@typeberry/logger";
import { Telemetry } from "@typeberry/telemetry";
import { Channel } from "@typeberry/workers-api";
import { initWorker } from "@typeberry/workers-api-node";
import { main } from "./main.js";
import { protocol as mainProtocol, NetworkingConfig } from "./protocol.js";

const logger = Logger.new(import.meta.filename, "network/bootstrap");

// `.then` instead of top-level `await`: bun's parentPort stops delivering messages while the worker module is suspended on top-level await.
initWorker(mainProtocol, NetworkingConfig.Codec)
  .then(async ({ config, comms }) => {
    const tele = Telemetry.initialize({
      nodeName: config.nodeName,
      worker: "network",
    });

    const port = config.ports.get(AUTHORSHIP_NETWORK_PORT);
    if (port === undefined) {
      throw new Error("Authorship network port not found in config");
    }

    const networkingComms = Channel.rx(authorshipProtocol, port);
    await main(config, comms, networkingComms);
    await tele?.close();
    process.exit(0);
  })
  .catch((e) => {
    logger.error`network worker failed: ${e}`;
    process.exit(1);
  });
