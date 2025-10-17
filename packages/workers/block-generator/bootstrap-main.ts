import { codec } from "@typeberry/codec";
import { initWorker } from "@typeberry/workers-api-node";
import { main } from "./main.js";
import { protocol } from "./protocol.js";

const { config, comms } = await initWorker(protocol, codec.nothing);
await main(config, comms);
