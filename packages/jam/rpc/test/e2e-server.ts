import { PvmBackend } from "@typeberry/config";
import { loadConfig, NODE_DEFAULTS } from "@typeberry/config-node";
import { Blake2b } from "@typeberry/hash";
import { getChainSpec, getDatabasePath } from "@typeberry/node";
import { validation } from "@typeberry/rpc-validation";
import { workspacePathFix } from "@typeberry/utils";
import { FjallWorkerConfig } from "@typeberry/workers-api-node";
import { handlers } from "../src/handlers.js";
import { RpcServer } from "../src/server.js";

const DEFAULT_PORT = 19800;

const withRelPath = workspacePathFix(`${import.meta.dirname}/../../../..`);

export async function startTestRpcServer(configPath: string, port = DEFAULT_PORT) {
  const blake2b = await Blake2b.createHasher();
  const nodeName = NODE_DEFAULTS.name;
  const nodeConfig = loadConfig([configPath], withRelPath);
  const spec = getChainSpec(nodeConfig.flavor);
  if (nodeConfig.databaseBasePath === undefined) {
    throw new Error("RPC server requires a persistent database path.");
  }

  const { dbPath } = getDatabasePath(
    blake2b,
    nodeName,
    nodeConfig.chainSpec.genesisHeader,
    withRelPath(nodeConfig.databaseBasePath),
  );

  const dbConfigParams = {
    nodeName,
    chainSpec: spec,
    workerParams: undefined,
    dbPath,
    blake2b,
  };
  const rootDb = await FjallWorkerConfig.new(dbConfigParams).openDatabase({ readonly: true });

  return RpcServer.new(port, rootDb, spec, blake2b, PvmBackend.Ananas, handlers, validation.schemas);
}
