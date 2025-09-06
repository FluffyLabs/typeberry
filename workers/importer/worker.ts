import { spawnWorkerGeneric } from "@typeberry/generic-worker";
import {
  MainReady,
} from "./state-machine.js";
import {Logger} from "@typeberry/logger";

const workerFile = new URL("./bootstrap-importer.mjs", import.meta.url);
const logger = Logger.new(import.meta.filename, "importer");

export async function spawnWorker(customLogger?: Logger, customMainReady?: MainReady) {
  const workerLogger = customLogger ?? logger;
  const mainReady = customMainReady ?? new MainReady();
  return spawnWorkerGeneric(workerFile, workerLogger, "ready(main)", mainReady);
}

