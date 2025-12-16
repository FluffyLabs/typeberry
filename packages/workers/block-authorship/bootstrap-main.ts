import { Telemetry } from "@typeberry/telemetry";
import { initWorker } from "@typeberry/workers-api-node";
import { main } from "./main.js";
import { BlockAuthorshipConfig, protocol } from "./protocol.js";

const { config, comms } = await initWorker(protocol, BlockAuthorshipConfig.Codec);
await main(config, comms);

// Initialize OpenTelemetry for this worker
const tele = Telemetry.initialize({
  worker: "generator",
  nodeName: config.nodeName,
});
await main(config, comms);
await tele?.close();
