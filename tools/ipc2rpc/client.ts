import { Socket } from "node:net";

import { MessageHandler, handleFragmentation } from "@typeberry/ext-ipc/handler.js";
import * as ce129 from "@typeberry/ext-ipc/protocol/ce-129-state-request.js";
import * as up0 from "@typeberry/ext-ipc/protocol/up-0-block-announcement.js";
import { MessageSenderAdapter } from "@typeberry/ext-ipc/server.js";
import { Logger } from "@typeberry/logger";

const logger = Logger.new(__filename, "ipc2rpc/client");

export function startClient(
  socketPath: string,
  getHandshake: () => up0.Handshake,
  onAnnouncement: (ann: up0.Announcement) => void,
): Promise<MessageHandler> {
  const client = new Socket();

  return new Promise((resolve) => {
    const messageHandler = new MessageHandler(new MessageSenderAdapter(client));
    messageHandler.registerHandlers(new up0.Handler(getHandshake, onAnnouncement));
    messageHandler.registerHandlers(new ce129.Handler(false));

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
