import { initWorker } from "@typeberry/workers-api-node";
import { main } from "./main.js";
import { NetworkingConfig, protocol } from "./protocol.js";

const { config, comms } = await initWorker(protocol, NetworkingConfig.Codec);
await main(config, comms);
