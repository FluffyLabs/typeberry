/** biome-ignore-all lint/suspicious/noConsole: for displaying help */
import { loadConfig, NODE_DEFAULTS } from "@typeberry/config-node";
import { LmdbRoot } from "@typeberry/database-lmdb";
import { Blake2b } from "@typeberry/hash";
import { parseSharedOptions } from "@typeberry/jam/args.js";
import { getChainSpec, getDatabasePath } from "@typeberry/node";
import { validation } from "@typeberry/rpc-validation";
import { workspacePathFix } from "@typeberry/utils";
import minimist from "minimist";
import packageJson from "./package.json" with { type: "json" };
import { handlers } from "./src/handlers.js";
import { RpcServer } from "./src/server.js";

const DEFAULT_PORT = 19800;

export const HELP = `
@typeberry/rpc ${packageJson.version} by Fluffy Labs.

Usage:
  rpc [options]

Options:
  --port                Port to listen on.
                        [default: ${DEFAULT_PORT}]
  --name                The name of the node whose database you'd like to connect to. Must be an exact match for the database to load correctly.
                        [default: ${NODE_DEFAULTS.name}]
  --config              The config of the node whose database you'd like to connect to. Must be an exact match for the database to load correctly.
                        [default: ${NODE_DEFAULTS.config}]
`;

const withRelPath = workspacePathFix(`${import.meta.dirname}/../..`);

export async function main(args: string[]) {
  let config: string[];
  let nodeName: string;

  const argv = minimist(args, {
    string: ["port", "name", "config"],
    boolean: ["help"],
    default: {
      port: DEFAULT_PORT.toString(),
    },
  });

  if (argv.help === true) {
    console.info(HELP);
    process.exit(0);
  }

  try {
    const parsed = parseSharedOptions(argv);
    config = parsed.config;
    nodeName = parsed.nodeName;
  } catch (e) {
    console.error(`\n${e}\n`);
    console.info(HELP);
    process.exit(1);
  }

  const blake2b = await Blake2b.createHasher();
  const port = Number.parseInt(argv.port, 10);
  const nodeConfig = loadConfig(config, withRelPath);
  const spec = getChainSpec(nodeConfig.flavor);
  if (nodeConfig.databaseBasePath === undefined) {
    throw new Error("RPC server requires a LMDB database path.");
  }

  const { dbPath } = getDatabasePath(
    blake2b,
    nodeName,
    nodeConfig.chainSpec.genesisHeader,
    withRelPath(nodeConfig.databaseBasePath),
  );

  const rootDb = new LmdbRoot(dbPath, true);
  const server = new RpcServer(port, rootDb, spec, blake2b, handlers, validation.schemas);

  process.on("SIGINT", async () => {
    await server.close();
    process.exit(0);
  });

  return server;
}
