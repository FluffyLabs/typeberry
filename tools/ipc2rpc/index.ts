import * as os from "node:os";
import * as path from "node:path";
import { tryAsTimeSlot } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { tinyChainSpec } from "@typeberry/config";
import { HASH_SIZE } from "@typeberry/hash";
import { up0 } from "@typeberry/jamnp-s";
import { Level, Logger } from "@typeberry/logger";
import { startClient } from "./client.js";
import { type Database, startRpc } from "./rpc.js";

const logger = Logger.new(import.meta.filename, "ipc2rpc");

main().catch((e) => {
  logger.error(`Main error: ${e}`);
  process.exit(-1);
});

async function main() {
  Logger.configureAll(process.env.JAM_LOG ?? "", Level.LOG);

  const isWindows = os.platform() === "win32";
  const socketPath = isWindows ? "\\\\.\\pipe\\typeberry" : path.join(os.tmpdir(), "typeberry.ipc");

  const db: Database = {
    bestHeader: null,
  };

  const getHandshake = () => {
    const final = up0.HashAndSlot.create({
      hash: Bytes.zero(HASH_SIZE).asOpaque(),
      slot: tryAsTimeSlot(0),
    });
    return up0.Handshake.create({ final, leafs: [] });
  };

  const client = await startClient(
    tinyChainSpec,
    socketPath,
    getHandshake,
    (_streamId, ann) => {
      db.bestHeader = ann.header;
    },
    (_streamId, _handshake) => {},
  );

  logger.info("Opening new UP0 stream.");
  client.withNewStream(up0.STREAM_KIND, (handler: up0.Handler, sender) => {
    logger.info("Sending handshake.");
    handler.sendHandshake(sender);
  });

  const rpcServer = startRpc(db, client);

  // wait for the client to finish and then close the server.
  await client.waitForEnd();
  logger.info("Client closed, terminating the RPC server.");
  rpcServer.close();
  logger.info("Server RPC terminated.");
}
