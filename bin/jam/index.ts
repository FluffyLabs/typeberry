import { Level, Logger } from "@typeberry/logger";
import { type Arguments, HELP, parseArgs } from "./args.js";
import { main } from "./main.js";

Logger.configureAll(process.env.JAM_LOG ?? "", Level.LOG);
const relPath = `${import.meta.dirname}/../..`;

let args: Arguments;

try {
  args = parseArgs(process.argv.slice(2), relPath);
} catch (e) {
  console.error(HELP);
  throw e;
}

main(args).catch((e) => {
  console.error(`${e}`);
  process.exit(-1);
});
