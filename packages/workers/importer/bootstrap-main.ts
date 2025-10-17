import { initWorker } from "@typeberry/workers-api-node";
import { main } from "./main.js";
import { ImporterConfig, protocol } from "./protocol.js";

const { config, comms } = await initWorker(protocol, ImporterConfig.Codec);
await main(config, comms);
// forcefully exit importer
process.exit(0);
