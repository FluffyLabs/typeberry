import { createServer, Socket } from 'node:net';
import * as path from 'node:path';
import * as os from 'node:os';
import { EventEmitter } from 'node:events';

import {Logger} from '@typeberry/logger';
import {MessageHandler, MessageSender} from './handler';
import * as up0 from './protocol/up-0-block-announcement';
import {BytesBlob} from '@typeberry/bytes';
import {U8} from '@typeberry/numbers';

class MessageSenderAdapter implements MessageSender {
  constructor(
    private readonly socket: Socket
  ) {}

  send(data: BytesBlob): void {
    this.socket.write(data.buffer);
  }

  close(): void {
    this.socket.end();
  }
}

export function startIpcServer(announcements: EventEmitter) {
  // Define the path for the socket or named pipe
  const isWindows = os.platform() === 'win32';
  const socketPath = isWindows
    ? '\\\\.\\pipe\\my_ipc_server'
    : path.join(os.tmpdir(), 'typeberry.ipc');

    const logger = Logger.new(__filename, "ext-ipc");

    // Create the IPC server
    const server = createServer((socket: Socket) => {
      logger.log('Client connected');
      const messageHandler = new MessageHandler(new MessageSenderAdapter(socket));
      messageHandler.registerHandlers(new up0.Handler());

      // Send block announcements
      const listener = (announcement: unknown) => {
        if (announcement instanceof up0.Announcement) {
          messageHandler.withStreamOfKind(0 as U8, (handler, sender) => {
            if (handler instanceof up0.Handler) {
              handler.sendAnnouncement(sender, announcement)
            }
          });
        }
      };
      announcements.on('announcement', listener);

      // Handle incoming data from the client
      socket.on('data', (data: Buffer) => {
        messageHandler.onServerMessage(data);
      });

      // Handle client disconnection
      socket.on('end', () => {
        logger.log('Client disconnected');
        messageHandler.onClose();
        announcements.off('annoucement', listener);
      });

      socket.on('error', (err) => {
        logger.error(`Socket error: ${err}`);
        messageHandler.onClose();
      });
    });

    // Start the server
    server.listen(socketPath, () => {
      logger.log(`IPC server is listening at ${socketPath}`);
    });

    // Handle server errors
    server.on('error', (err) => {
      logger.error(`Server error:  ${err}`);
    });
}
