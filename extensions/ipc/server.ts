import type { EventEmitter } from "node:events";
import * as fs from "node:fs";
import { type Socket, createServer } from "node:net";
import * as os from "node:os";
import * as path from "node:path";

import type { HeaderHash } from "@typeberry/block";
import type { Bytes, BytesBlob } from "@typeberry/bytes";
import { Logger } from "@typeberry/logger";
import type { TrieNode } from "@typeberry/trie/nodes";
import { MessageHandler, type MessageSender, handleFragmentation, sendWithLengthPrefix } from "./handler";
import * as ce129 from "./protocol/ce-129-state-request";
import * as up0 from "./protocol/up-0-block-announcement";

export class MessageSenderAdapter implements MessageSender {
  constructor(private readonly socket: Socket) {}

  send(data: BytesBlob): void {
    sendWithLengthPrefix(this.socket, data.buffer);
  }

  close(): void {
    this.socket.end();
  }
}

export function startIpcServer(
  announcements: EventEmitter,
  getHandshake: () => up0.Handshake,
  getBoundaryNodes: (hash: HeaderHash, startKey: Bytes<ce129.KEY_SIZE>, endKey: Bytes<ce129.KEY_SIZE>) => TrieNode[],
  getKeyValuePairs: (
    hash: HeaderHash,
    startKey: Bytes<ce129.KEY_SIZE>,
    endKey: Bytes<ce129.KEY_SIZE>,
  ) => ce129.KeyValuePair[],
) {
  // Define the path for the socket or named pipe
  const isWindows = os.platform() === "win32";
  const socketPath = isWindows ? "\\\\.\\pipe\\typeberry" : path.join(os.tmpdir(), "typeberry.ipc");

  const logger = Logger.new(__filename, "ext-ipc");

  // Create the IPC server
  const server = createServer((socket: Socket) => {
    logger.log("Client connected");
    const messageHandler = new MessageHandler(new MessageSenderAdapter(socket));
    messageHandler.registerHandlers(new up0.Handler(getHandshake, () => {}));
    messageHandler.registerHandlers(new ce129.Handler(true, getBoundaryNodes, getKeyValuePairs));

    // Send block announcements
    const listener = (announcement: unknown) => {
      if (announcement instanceof up0.Announcement) {
        messageHandler.withStreamOfKind(up0.STREAM_KIND, (handler: up0.Handler, sender) => {
          handler.sendAnnouncement(sender, announcement);
        });
      } else {
        throw new Error(`Invalid annoncement received: ${announcement}`);
      }
    };
    announcements.on("announcement", listener);

    // Handle incoming data from the client
    socket.on(
      "data",
      handleFragmentation((data: Buffer) => {
        try {
          messageHandler.onSocketMessage(data);
        } catch (e) {
          logger.error(`Received invalid data on socket: ${e}. Closing connection.`);
          socket.end();
        }
      }),
    );

    // Handle client disconnection
    socket.on("end", () => {
      logger.log("Client disconnected");
      messageHandler.onClose();
      announcements.off("annoucement", listener);
    });

    socket.on("error", (err) => {
      logger.error(`Socket error: ${err}`);
      messageHandler.onClose();
      socket.end();
    });
  });

  // Start the server (remove old socket if present)
  try {
    fs.unlinkSync(socketPath);
  } catch {}

  const controller = new AbortController();
  server.listen(
    {
      path: socketPath,
      signal: controller.signal,
    },
    () => {
      logger.log(`IPC server is listening at ${socketPath}`);
    },
  );

  // Handle server errors
  server.on("error", (err) => {
    throw err;
  });

  return {
    server,
    close: () => controller.abort(),
  };
}
