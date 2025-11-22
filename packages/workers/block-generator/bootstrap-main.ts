import { codec } from "@typeberry/codec";
import { initializeTelemetry } from "@typeberry/telemetry";
import { initWorker } from "@typeberry/workers-api-node";
import { main } from "./main.js";
import { protocol } from "./protocol.js";

const { config, comms } = await initWorker(protocol, codec.nothing);
// Initialize OpenTelemetry for this worker
initializeTelemetry({
  worker: "generator",
  nodeName: config.nodeName,
});

await main(config, comms);
