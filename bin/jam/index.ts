import { pathToFileURL } from "node:url";
import { Level, Logger } from "@typeberry/logger";
import { type Arguments, HELP, parseArgs } from "./args.js";
import { main } from "./main.js";

export { main } from "./main.js";
export { Command, KnownChainSpec } from "./args.js";

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  Logger.configureAll(process.env.JAM_LOG ?? "", Level.LOG);
  const relPath = `${import.meta.dirname}/../..`;

  let args: Arguments;

  try {
    args = parseArgs(process.argv.slice(2), relPath);
  } catch (e) {
    console.error(`\n${e}\n`);
    console.info(HELP);
    process.exit(1);
  }

  main(args).catch((e) => {
    console.error(`${e}`);
    process.exit(-1);
  });
}
