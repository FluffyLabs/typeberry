import { initializeTelemetry } from "@typeberry/telemetry";
import { initWorker } from "@typeberry/workers-api-node";
import { main } from "./main.js";
import { NetworkingConfig, protocol } from "./protocol.js";

const { config, comms } = await initWorker(protocol, NetworkingConfig.Codec);
// Initialize OpenTelemetry for this worker
initializeTelemetry({
  nodeName: config.nodeName,
  worker: "network",
});

await main(config, comms);
