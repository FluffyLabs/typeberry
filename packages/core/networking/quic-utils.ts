import type { QUICClient, QUICConnection, QUICServer, QUICStream } from "@matrixai/quic";
import { Logger } from "@typeberry/logger";

const logger = Logger.new(import.meta.filename, "net");

export function addEventListener<T extends Event>(
  target: QUICServer | QUICClient | QUICConnection | QUICStream,
  // biome-ignore lint/suspicious/noExplicitAny: any is used here to match all possible event constructors.
  clazz: { new (...args: any[]): T },
  callback: (ev: T) => void | Promise<void>,
) {
  target.addEventListener(clazz.name, async (ev: T) => {
    try {
      await callback(ev);
    } catch (e) {
      logger.error`Unhandled exception in ${clazz.name} event handler: ${e}`;
    }
  });
}
