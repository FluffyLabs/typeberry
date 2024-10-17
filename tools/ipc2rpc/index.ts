import * as os from "node:os";
import * as path from "node:path";
import { HASH_SIZE, type HeaderHash, type TimeSlot } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import * as up0 from "@typeberry/ext-ipc/protocol/up-0-block-announcement";
import { Level, Logger } from "@typeberry/logger";
import { startClient } from "./client";
import { type Database, startRpc } from "./rpc";

main();

const logger = Logger.new(__filename, "ipc2rpc");

async function main() {
  Logger.configureAll(process.env.JAM_LOG ?? "", Level.LOG);

  const isWindows = os.platform() === "win32";
  const socketPath = isWindows ? "\\\\.\\pipe\\typeberry" : path.join(os.tmpdir(), "typeberry.ipc");

  const db: Database = {
    bestHeader: null,
  };

  const _rpcServer = startRpc(db);

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

  // TODO [ToDr] reconnect?
}
