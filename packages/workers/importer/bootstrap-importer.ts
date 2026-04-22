import { Logger } from "@typeberry/logger";
import { Telemetry } from "@typeberry/telemetry";
import { initWorker } from "@typeberry/workers-api-node";
import { main } from "./main.js";
import { ImporterConfig, protocol } from "./protocol.js";

const logger = Logger.new(import.meta.filename, "importer/bootstrap");

// `.then` instead of top-level `await`: bun's parentPort stops delivering messages while the worker module is suspended on top-level await.
initWorker(protocol, ImporterConfig.Codec)
  .then(async ({ config, comms }) => {
    // Initialize OpenTelemetry for this worker
    const sdk = Telemetry.initialize({
      nodeName: config.nodeName,
      worker: "importer",
    });
    await main(config, comms);
    await sdk?.close();
    // forcefully exit importer
    process.exit(0);
  })
  .catch((e) => {
    logger.error`importer worker failed: ${e}`;
    process.exit(1);
  });
