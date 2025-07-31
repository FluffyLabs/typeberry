import * as fs from "node:fs";
import { type Socket, createServer } from "node:net";
import * as os from "node:os";
import * as path from "node:path";

import type { HeaderHash } from "@typeberry/block";
import type { ChainSpec } from "@typeberry/config";
import { ce129, up0 } from "@typeberry/jamnp-s";
import { Logger } from "@typeberry/logger";
import { handleMessageFragmentation } from "@typeberry/networking";
import type { Listener } from "@typeberry/state-machine";
import type { TrieNode } from "@typeberry/trie/nodes.js";
import { IpcHandler } from "./handler.js";

export function startIpcServer(
  spec: ChainSpec,
  announcements: Listener<up0.Announcement>,
  getHandshake: () => up0.Handshake,
  getBoundaryNodes: (hash: HeaderHash, startKey: ce129.Key, endKey: ce129.Key) => TrieNode[],
  getKeyValuePairs: (hash: HeaderHash, startKey: ce129.Key, endKey: ce129.Key) => ce129.KeyValuePair[],
) {
  // Define the path for the socket or named pipe
  const isWindows = os.platform() === "win32";
  const socketPath = isWindows ? "\\\\.\\pipe\\typeberry" : path.join(os.tmpdir(), "typeberry.ipc");

  const logger = Logger.new(import.meta.filename, "ext-ipc");

  // Create the IPC server
  const server = createServer((socket: Socket) => {
    logger.log("Client connected");
    const messageHandler = new IpcHandler(socket);
    messageHandler.registerHandlers(
      new up0.Handler(
        spec,
        getHandshake,
        () => {},
        () => {},
      ),
    );
    messageHandler.registerHandlers(new ce129.Handler(true, getBoundaryNodes, getKeyValuePairs));

    // Send block announcements
    const listener = (announcement: up0.Announcement) => {
      messageHandler.withStreamOfKind(up0.STREAM_KIND, (handler: up0.Handler, sender) => {
        handler.sendAnnouncement(sender, announcement);
      });
    };
    announcements.on(listener);

    // Handle incoming data from the client
    socket.on(
      "data",
      handleMessageFragmentation(
        (data: Uint8Array) => {
          try {
            messageHandler.onSocketMessage(data);
          } catch (e) {
            logger.error(`Received invalid data on socket: ${e}. Closing connection.`);
            socket.end();
          }
        },
        () => {
          logger.error("Received too much data on socket. Closing connection.");
          socket.end();
        },
      ),
    );

    // Handle client disconnection
    socket.on("end", () => {
      logger.log("Client disconnected");
      messageHandler.onClose({});
      announcements.off(listener);
    });

    socket.on("error", (error) => {
      logger.error(`Socket error: ${error}`);
      messageHandler.onClose({ error });
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

  return () => {
    logger.info("Closing IPC server.");
    // stop accepting new connections
    server.close();
    // abort the server
    controller.abort();
    // unrefing
    server.unref();
  };
}
