import * as fs from "node:fs";
import { createServer, type Socket } from "node:net";
import * as os from "node:os";
import * as path from "node:path";

import type { BytesBlob } from "@typeberry/bytes";
import { Logger } from "@typeberry/logger";
import { encodeMessageLength, handleMessageFragmentation } from "@typeberry/networking";

/** A per-client handler of incoming socket messages. */
export interface IpcHandler {
  /** New data on the socket received. */
  onSocketMessage(msg: Uint8Array): Promise<void>;

  /** Socket closed or errored. */
  onClose(reason: { error?: Error }): void;
}

/** Sending data abstraction on a socket. */
export class IpcSender {
  constructor(private readonly socket: Socket) {}

  /** Write given data to the outgoing socket. */
  send(data: BytesBlob): void {
    sendWithLengthPrefix(this.socket, data.raw);
  }

  /** Close the socket. */
  close(): void {
    this.socket.end();
  }
}

export function startIpcServer(name: string, newMessageHandler: (socket: IpcSender) => IpcHandler) {
  // Define the path for the socket or named pipe
  const isWindows = os.platform() === "win32";
  const linuxPath = name.startsWith("/") ? name : path.join(os.tmpdir(), `${name}`);
  const socketPath = isWindows ? `\\\\.\\pipe\\${name}` : linuxPath;

  const logger = Logger.new(import.meta.filename, "ext-ipc");

  // Create the IPC server
  const server = createServer((socket: Socket) => {
    logger.log("Client connected");
    const messageHandler = newMessageHandler(new IpcSender(socket));

    // Handle incoming data from the client
    socket.on(
      "data",
      handleMessageFragmentation(
        async (data: Uint8Array) => {
          try {
            // to avoid buffering too much data in our memory, we pause
            // reading more data from the socket and only resume when the message
            // is processed.
            socket.pause();
            await messageHandler.onSocketMessage(data);
          } catch (e) {
            logger.error(`Received invalid data on socket: ${e}. Closing connection.`);
            socket.end();
          } finally {
            socket.resume();
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

/**
 * Send a message to the socket, prefixed with a 32-bit length
 * so the receiver can determine the boundaries between data items.
 */
function sendWithLengthPrefix(socket: Socket, data: Uint8Array) {
  socket.write(encodeMessageLength(data));
  socket.write(data);
}
