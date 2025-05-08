import { type ChainSpec, fullChainSpec, tinyChainSpec } from "@typeberry/config";
import minimist from "minimist";
import { RpcServer } from "./src/server";

function main() {
  const argv = minimist(process.argv.slice(2), {
    string: ["db-path", "genesis-root", "port", "chain-spec"],
    default: {
      port: "19800",
      "db-path": "database",
      "genesis-root": "0000000000000000000000000000000000000000000000000000000000000000",
      "chain-spec": "tiny",
    },
  });

  const port = Number.parseInt(argv.port, 10);
  const dbPath = argv["db-path"];
  const genesisRoot = `0x${argv["genesis-root"]}`;

  let chainSpec: ChainSpec;
  switch (argv["chain-spec"]) {
    case "tiny":
      chainSpec = tinyChainSpec;
      break;
    case "full":
      chainSpec = fullChainSpec;
      break;
    default:
      throw new Error("chain-spec must be either 'tiny' or 'full'");
  }

  const server = new RpcServer(port, dbPath, genesisRoot, chainSpec);

  process.on("SIGINT", async () => {
    await server.close();
    process.exit(0);
  });
}

main();
