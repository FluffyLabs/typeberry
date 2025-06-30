import { Socket } from "node:net";

import { IpcHandler } from "@typeberry/ext-ipc/handler.js";
import { type StreamId, ce129, up0 } from "@typeberry/jamnp-s";
import { Logger } from "@typeberry/logger";
import { handleMessageFragmentation } from "@typeberry/networking";

const logger = Logger.new(import.meta.filename, "ipc2rpc/client");

export function startClient(
  socketPath: string,
  getHandshake: () => up0.Handshake,
  onAnnouncement: (streamId: StreamId, ann: up0.Announcement) => void,
  onHandshake: (streamId: StreamId, handshake: up0.Handshake) => void,
): Promise<IpcHandler> {
  const client = new Socket();

  return new Promise((resolve) => {
    const messageHandler = new IpcHandler(client);
    messageHandler.registerHandlers(new up0.Handler(getHandshake, onAnnouncement, onHandshake));
    messageHandler.registerHandlers(new ce129.Handler(false));

    client.connect(socketPath, () => {
      logger.log("Connected to IPC server");

      resolve(messageHandler);
    });

    client.setTimeout(10000);

    client.on(
      "data",
      handleMessageFragmentation((data) => {
        try {
          messageHandler.onSocketMessage(data);
        } catch (e) {
          logger.error(`Received invalid data on socket: ${e}. Closing connection.`);
          client.end();
        }
      }),
    );

    client.on("timeout", () => {
      messageHandler.onClose({ error: new Error("socket timeout") });
      client.end();
    });

    client.on("error", (error) => {
      logger.error(`${error}`);
      messageHandler.onClose({ error });
      client.end();
    });

    client.on("close", () => {
      messageHandler.onClose({});
    });

    resolve(messageHandler);
  });
}
