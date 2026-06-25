import { Telemetry } from "@typeberry/telemetry";
import { initWorker } from "@typeberry/workers-api-node";
import { main } from "./main.js";
import { ImporterConfig, protocol } from "./protocol.js";

const { config, comms, ready } = await initWorker(protocol, ImporterConfig.Codec);
// Initialize OpenTelemetry for this worker
const sdk = Telemetry.initialize({
  nodeName: config.nodeName,
  worker: "importer",
});
await main(config, comms, ready);
await sdk?.close();
// forcefully exit importer
process.exit(0);
