import { Buffer } from "node:buffer";
import * as fs from "node:fs";
import { type Socket, createServer } from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import { Encoder } from "@typeberry/codec";

import type { BytesBlob } from "@typeberry/bytes";
import { Logger } from "@typeberry/logger";

/** A per-client handler of incoming socket messages. */
export interface IpcHandler {
  /** New data on the socket received. */
  onSocketMessage(msg: Uint8Array): void;

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
  const socketPath = isWindows ? `\\\\.\\pipe\\${name}` : path.join(os.tmpdir(), `${name}.ipc`);

  const logger = Logger.new(import.meta.filename, "ext-ipc");

  // Create the IPC server
  const server = createServer((socket: Socket) => {
    logger.log("Client connected");
    const messageHandler = newMessageHandler(new IpcSender(socket));

    // Handle incoming data from the client
    socket.on(
      "data",
      handleFragmentation((data: Buffer) => {
        try {
          messageHandler.onSocketMessage(new Uint8Array(data));
        } catch (e) {
          logger.error(`Received invalid data on socket: ${e}. Closing connection.`);
          socket.end();
        }
      }),
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

const MSG_LEN_PREFIX_BYTES = 4;

/**
 * Send a message to the socket, but prefix it with a 32-bit length,
 * so that the receiver can now the boundaries between the datum.
 */
function sendWithLengthPrefix(socket: Socket, data: Uint8Array) {
  const buffer = new Uint8Array(MSG_LEN_PREFIX_BYTES);
  const encoder = Encoder.create({
    destination: buffer,
  });
  encoder.i32(data.length);
  socket.write(buffer);
  socket.write(data);
}

/**
 * Only triggers the `callback` in case full data blob is received.
 *
 * Each message should be prefixed with a single U32 denoting the length of the next data
 * frame that should be interpreted as single chunk.
 */
export function handleFragmentation(callback: (data: Buffer) => void): (data: Buffer) => void {
  let buffer = Buffer.alloc(0);
  let expectedLength = -1;

  return (data: Buffer) => {
    buffer = Buffer.concat([buffer, data]);
    do {
      // we now expect a length prefix.
      if (expectedLength === -1) {
        // not enough data to parse the length, wait for more.
        if (buffer.length < MSG_LEN_PREFIX_BYTES) {
          break;
        }

        expectedLength = buffer.readUint32LE();
        buffer = buffer.subarray(MSG_LEN_PREFIX_BYTES);
      }

      // we don't have enough data, so let's wait.
      if (buffer.length < expectedLength) {
        break;
      }

      // full chunk can be parsed now, but there might be some more.
      const chunk = buffer.subarray(0, expectedLength);
      buffer = buffer.subarray(expectedLength);
      expectedLength = -1;
      callback(chunk);
    } while (buffer.length > 0);
  };
}
