import path from "node:path";
import { fileURLToPath } from "node:url";

import { type Arguments, HELP, parseArgs } from "@typeberry/jam/args.js";
import { main } from "@typeberry/jam/main.js";
import { Logger } from "@typeberry/logger/index.js";
import { Level } from "@typeberry/logger/options.js";

export { main } from "@typeberry/jam/main.js";
export { Command, KnownChainSpec } from "@typeberry/jam/args.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
