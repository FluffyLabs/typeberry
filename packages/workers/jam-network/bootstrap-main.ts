import { protocol as authorshipProtocol } from "@typeberry/comms-authorship-network";
import { Telemetry } from "@typeberry/telemetry";
import { Channel } from "@typeberry/workers-api";
import { initWorker } from "@typeberry/workers-api-node";
import { main } from "./main.js";
import { protocol as mainProtocol, NetworkingConfig } from "./protocol.js";

const { config, comms } = await initWorker(mainProtocol, NetworkingConfig.Codec);

// Initialize OpenTelemetry for this worker
const tele = Telemetry.initialize({
  nodeName: config.nodeName,
  worker: "network",
});

const port = config.ports.get("authorship-network");
if (port === undefined) {
  throw new Error("Authorship network port not found in config");
}

const networkingComms = Channel.rx(authorshipProtocol, port);
await main(config, comms, networkingComms);
await tele?.close();
