import { pathToFileURL } from "node:url";
import { type ChainSpec, fullChainSpec, tinyChainSpec } from "@typeberry/config";
import { KnownChainSpec } from "@typeberry/jam";
import minimist from "minimist";
import { methods } from "./src/method-loader.js";
import { RpcServer } from "./src/server.js";

export function main(args: string[]) {
  const argv = minimist(args, {
    string: ["db-path", "genesis-root", "port", "chain-spec"],
    default: {
      port: "19800",
      "db-path": "../../database",
      "genesis-root": "c07cdbce686c64d0a9b6539c70b0bb821b6a74d9de750a46a5da05b5640c290a",
      "chain-spec": KnownChainSpec.Tiny,
    },
  });

  const port = Number.parseInt(argv.port, 10);
  const dbPath = argv["db-path"];
  const genesisRoot = `0x${argv["genesis-root"]}`;
  const chainSpec = parseChainSpec(argv["chain-spec"]);

  const server = new RpcServer(port, dbPath, genesisRoot, chainSpec, methods);

  process.on("SIGINT", async () => {
    await server.close();
    process.exit(0);
  });

  return server;
}

function parseChainSpec(chainSpec: string): ChainSpec {
  switch (chainSpec) {
    case KnownChainSpec.Tiny:
      return tinyChainSpec;
    case KnownChainSpec.Full:
      return fullChainSpec;
    default:
      throw new Error("chain-spec must be either 'tiny' or 'full'");
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}
