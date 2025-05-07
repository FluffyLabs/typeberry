import { tinyChainSpec } from "@typeberry/config";
import minimist from "minimist";
import { RpcServer } from "./src/server";

function main() {
  const argv = minimist(process.argv.slice(2), {
    string: ["db-path", "genesis-root", "port"],
    default: {
      port: "19800",
      "db-path": "database",
      "genesis-root": "0000000000000000000000000000000000000000000000000000000000000000",
    },
  });

  const port = Number.parseInt(argv.port, 10);
  const dbPath = argv["db-path"];
  const genesisRoot = `0x${argv["genesis-root"]}`;

  const server = new RpcServer(port, dbPath, genesisRoot, tinyChainSpec);

  process.on("SIGINT", async () => {
    await server.close();
    process.exit(0);
  });
}

main();
