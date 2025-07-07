import { Level, Logger } from "@typeberry/logger";
import { Arguments, HELP, parseArgs } from "./args.js";
import { main } from "./main.js";

Logger.configureAll(process.env.JAM_LOG ?? "", Level.LOG);

let args: Arguments;

try {
  args = parseArgs(process.argv.slice(2));
} catch (e) {
  console.log(`\n${e}\n`);
  console.info(HELP);
  process.exit(1);
}

main(args).catch((e) => {
  console.error(`${e}`);
  process.exit(-1);
});
