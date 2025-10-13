export * from "./main.js";
export * from "./protocol.js";
export const WORKER = new URL(import.meta.resolve("./bootstrap-importer.mjs"));
