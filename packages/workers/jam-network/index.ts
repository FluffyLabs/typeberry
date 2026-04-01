export * from "./main.js";
export * from "./protocol.js";
export const WORKER = new URL("./bootstrap-network.mjs", import.meta.url);
export const WORKER_BUN = new URL("./bootstrap-main.ts", import.meta.url);
