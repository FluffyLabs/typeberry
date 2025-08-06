import { Socket } from "node:net";

import { JamnpIpcHandler } from "@typeberry/ext-ipc/jamnp/handler.js";
import { IpcSender, handleFragmentation } from "@typeberry/ext-ipc/server.js";
import { ce129, up0 } from "@typeberry/jamnp-s";
import { Logger } from "@typeberry/logger";

const logger = Logger.new(import.meta.filename, "ipc2rpc/client");

export function startClient(
  socketPath: string,
  getHandshake: () => up0.Handshake,
  onAnnouncement: (ann: up0.Announcement) => void,
): Promise<JamnpIpcHandler> {
  const client = new Socket();

  return new Promise((resolve) => {
    const messageHandler = new JamnpIpcHandler(new IpcSender(client));
    messageHandler.registerStreamHandlers(new up0.Handler(getHandshake, onAnnouncement));
    messageHandler.registerStreamHandlers(new ce129.Handler(false));

    client.connect(socketPath, () => {
      logger.log("Connected to IPC server");

      resolve(messageHandler);
    });

    client.setTimeout(10000);

    client.on(
      "data",
      handleFragmentation((data) => {
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
