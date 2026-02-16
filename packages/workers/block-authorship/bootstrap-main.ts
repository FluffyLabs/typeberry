import { protocol as networkProtocol } from "@typeberry/comms-authorship-network";
import { Telemetry } from "@typeberry/telemetry";
import { Channel } from "@typeberry/workers-api";
import { initWorker } from "@typeberry/workers-api-node";
import { main } from "./main.js";
import { BlockAuthorshipConfig, protocol as mainProtocol } from "./protocol.js";

const { config, comms, threadComms } = await initWorker(mainProtocol, BlockAuthorshipConfig.Codec);

// Initialize OpenTelemetry for this worker
const tele = Telemetry.initialize({
  worker: "generator",
  nodeName: config.nodeName,
});

threadComms.once(async (msg) => {
  if (msg.threadName !== "block-authorship") {
    throw new Error(`Unexpected thread name: ${msg.threadName}`);
  }
  const port = config.ports.get("network");
  if (port === undefined) {
    throw new Error("Network port not found in config");
  }
  const networkingComms = Channel.tx(networkProtocol, port);
  await main(config, comms, networkingComms);
  await tele?.close();
});
