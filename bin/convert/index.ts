// biome-ignore-all lint/suspicious/noConsole: bin file

import { pathToFileURL } from "node:url";
import { Level, Logger } from "@typeberry/logger";
import { workspacePathFix } from "@typeberry/utils";
import { type Arguments, HELP, parseArgs } from "./args.js";
import { main } from "./main.js";

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  Logger.configureAll(process.env.JAM_LOG ?? "", Level.LOG);
  const withRelPath = workspacePathFix(`${import.meta.dirname}/../..`);

  let args: Arguments;

  try {
    args = parseArgs(process.argv.slice(2), withRelPath);
  } catch (e) {
    console.error(`\n${e}\n`);
    console.info(HELP);
    process.exit(1);
  }

  try {
    main(args, withRelPath);
  } catch (e) {
    console.error(`${e}`);
    process.exit(-1);
  }
}
