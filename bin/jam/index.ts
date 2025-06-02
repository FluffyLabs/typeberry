import { Level, Logger } from "@typeberry/logger";
import { type Arguments, HELP, parseArgs } from "./args";
import { main } from "./main";

Logger.configureAll(process.env.JAM_LOG ?? "", Level.LOG);
const relPath = `${__dirname}/../..`;

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
