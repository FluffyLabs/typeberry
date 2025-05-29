import { type ChainSpec, fullChainSpec, tinyChainSpec } from "@typeberry/config";
import minimist from "minimist";
import { methods } from "./src/method-loader";
import { RpcServer } from "./src/server";

function main(args: string[]) {
  const argv = minimist(args, {
    string: ["db-path", "genesis-root", "port", "chain-spec"],
    default: {
      port: "19800",
      "db-path": "../../database",
      "genesis-root": "0000000000000000000000000000000000000000000000000000000000000000",
      "chain-spec": "tiny",
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
}

function parseChainSpec(chainSpec: string): ChainSpec {
  switch (chainSpec) {
    case "tiny":
      return tinyChainSpec;
    case "full":
      return fullChainSpec;
    default:
      throw new Error("chain-spec must be either 'tiny' or 'full'");
  }
}

main(process.argv.slice(2));
