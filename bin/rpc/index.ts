import { pathToFileURL } from "node:url";
import { getChainSpec, loadConfig, openDatabase } from "@typeberry/jam/main.js";
import minimist from "minimist";
import { DEFAULTS } from "../jam-cli/args.js";
import { methods } from "./src/method-loader.js";
import { RpcServer } from "./src/server.js";

// TODO: [MaSo] Could be starting like `bin/jam`
// from giving a config file to `main` function
// and separating cli from main funcionality
export function main(args: string[]) {
  const argv = minimist(args, {
    string: ["port", "nodeName", "config"],
    default: {
      port: "19800",
      nodeName: DEFAULTS.name,
      config: DEFAULTS.config,
    },
  });

  const port = Number.parseInt(argv.port, 10);
  const config = loadConfig(argv.config);
  const spec = getChainSpec(config.flavor);
  const { rootDb } = openDatabase(argv.nodeName, config.chainSpec.genesisHeader, `../../${config.databaseBasePath}`, {
    readOnly: true,
  });

  const server = new RpcServer(port, rootDb, spec, methods);

  process.on("SIGINT", async () => {
    await server.close();
    process.exit(0);
  });

  return server;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}
