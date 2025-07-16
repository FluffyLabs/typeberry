import { pathToFileURL } from "node:url";
import { JamConfig, loadConfig, main } from "@typeberry/jam";
import { Level, Logger } from "@typeberry/logger";
import { type Arguments, Command, HELP, parseArgs } from "./args.js";

export * from "./args.js";

export const prepareConfigFile = (args: Arguments): JamConfig => {
  const files = args.command === Command.Import ? args.args.files : [];
  const nodeConfig = loadConfig(args.args.configPath);
  return JamConfig.new({ isAuthoring: false, blockToImport: files, nodeName: args.args.nodeName, nodeConfig });
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  Logger.configureAll(process.env.JAM_LOG ?? "", Level.LOG);
  const relPath = `${import.meta.dirname}/../..`;
  const withRelPath = (p: string) => {
    if (p.startsWith("/")) {
      return p;
    }
    return `${relPath}/${p}`;
  };

  let args: Arguments;

  try {
    args = parseArgs(process.argv.slice(2), withRelPath);
  } catch (e) {
    console.error(`\n${e}\n`);
    console.info(HELP);
    process.exit(1);
  }

  main(prepareConfigFile(args), withRelPath).catch((e) => {
    console.error(`${e}`);
    process.exit(-1);
  });
}
