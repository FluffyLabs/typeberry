import { initWorker } from "@typeberry/workers-api-node";
import { main } from "./main.js";
import { BlockAuthorshipConfig, protocol } from "./protocol.js";

const { config, comms } = await initWorker(protocol, BlockAuthorshipConfig.Codec);
await main(config, comms);
