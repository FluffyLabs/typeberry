import { Socket } from "node:net";

import { MessageHandler } from "@typeberry/ext-ipc/handler";
import * as ce129 from "@typeberry/ext-ipc/protocol/ce-129-state-request";
import * as up0 from "@typeberry/ext-ipc/protocol/up-0-block-announcement";
import { MessageSenderAdapter } from "@typeberry/ext-ipc/server";
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

    client.on("data", (data) => {
      messageHandler.onSocketMessage(data);
    });

    client.on("error", (e) => {
      throw e;
    });

    resolve(messageHandler);
  });
}
