import * as os from "node:os";
import * as path from "node:path";
import type { HeaderHash, TimeSlot } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import * as up0 from "@typeberry/ext-ipc/protocol/up-0-block-announcement";
import { HASH_SIZE } from "@typeberry/hash";
import { Level, Logger } from "@typeberry/logger";
import { startClient } from "./client";
import { type Database, startRpc } from "./rpc";

const logger = Logger.new(__filename, "ipc2rpc");

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
    const final = new up0.HashAndSlot(Bytes.zero(HASH_SIZE) as HeaderHash, 0 as TimeSlot);
    return new up0.Handshake(final, []);
  };

  const client = await startClient(socketPath, getHandshake, (ann: up0.Announcement) => {
    db.bestHeader = ann.header;
  });

  logger.info("Opening new UP0 stream.");
  client.withNewStream(up0.STREAM_KIND, (handler: up0.Handler, sender) => {
    logger.info("Sending handshake.");
    handler.sendHandshake(sender, getHandshake());
  });

  const rpcServer = startRpc(db, client);

  // wait for the client to finish and then close the server.
  await client.waitForEnd();
  logger.info("Client closed, terminating the RPC server.");
  rpcServer.close();
  logger.info("Server RPC terminated.");
}
