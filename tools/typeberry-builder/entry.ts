import { main } from "@typeberry/jam";
import { type Arguments, HELP, parseArgs } from "@typeberry/jam/args.js";
import { Level, Logger } from "@typeberry/logger";

export * from "@typeberry/jam";

Logger.configureAll(process.env.JAM_LOG ?? "", Level.LOG);

let args: Arguments;

try {
  args = parseArgs(process.argv.slice(2), withRelPath);
} catch (e) {
  console.error(`\n${e}\n`);
  console.info(HELP);
  process.exit(1);
}

main(args, withRelPath).catch((e) => {
  console.error(`${e}`);
  process.exit(-1);
});

/**
 * We assume the binary is run directly (and not via workspace),
 * so the paths don't need special resolving.
 */
function withRelPath(s: string) {
  return s;
}
