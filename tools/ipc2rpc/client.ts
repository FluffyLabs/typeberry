import { Socket } from 'node:net';

import * as up0 from '@typeberry/ext-ipc/protocol/up-0-block-announcement';
import {MessageHandler} from '@typeberry/ext-ipc/handler';
import {MessageSenderAdapter} from '@typeberry/ext-ipc/server';

export function startClient(socketPath: string): Promise<MessageHandler> {
  const client = new Socket();

  return new Promise((resolve) => {
    const messageHandler = new MessageHandler(new MessageSenderAdapter(client));
    messageHandler.registerHandlers(new up0.Handler());

    client.connect(socketPath, () => {
      console.log('Connected to IPC server');

      resolve(messageHandler);
    });

    client.on('data', (data) => {
      messageHandler.onSocketMessage(data)
    });

    client.on('error', (e) => {
      throw e;
    });

    resolve(messageHandler);
  });
}
