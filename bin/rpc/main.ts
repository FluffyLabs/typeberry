import { loadConfig, NODE_DEFAULTS } from "@typeberry/config-node";
import { LmdbRoot } from "@typeberry/database-lmdb";
import { Blake2b } from "@typeberry/hash";
import { getChainSpec, getDatabasePath } from "@typeberry/node";
import { workspacePathFix } from "@typeberry/utils";
import minimist from "minimist";
import { methods } from "./src/method-loader.js";
import { RpcServer } from "./src/server.js";

const withRelPath = workspacePathFix(`${import.meta.dirname}/../..`);

export async function main(args: string[]) {
  const argv = minimist(args, {
    string: ["port", "nodeName", "config"],
    default: {
      port: "19800",
      nodeName: NODE_DEFAULTS.name,
      config: NODE_DEFAULTS.config,
    },
  });

  const blake2b = await Blake2b.createHasher();
  const port = Number.parseInt(argv.port, 10);
  const config = loadConfig(argv.config);
  const spec = getChainSpec(config.flavor);
  const { dbPath } = getDatabasePath(
    blake2b,
    argv.nodeName,
    config.chainSpec.genesisHeader,
    withRelPath(config.databaseBasePath ?? "<in-memory>"),
  );

  const rootDb = new LmdbRoot(dbPath, true);
  const server = new RpcServer(port, rootDb, spec, blake2b, methods);

  process.on("SIGINT", async () => {
    await server.close();
    process.exit(0);
  });

  return server;
}
