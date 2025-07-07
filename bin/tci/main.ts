import { isMainThread } from "node:worker_threads";
import { Logger } from "@typeberry/logger";
import { Arguments } from "./args.js";

const logger = Logger.new(import.meta.filename, "tci");

export async function main(_args: Arguments) {
  if (!isMainThread) {
    logger.error("The main binary cannot be runnig as a worker!");
    return;
  }

  // TODO: [MaSo] Run typeberry with given args
}
