import { Logger } from "@typeberry/logger";
import { check } from "@typeberry/utils";
import type { Port } from "./port.js";
import type { HandlerKey, Handlers, LousyProtocol, MessageCodecs, Rx, SenderKey, Senders, Tx } from "./types.js";

const logger = Logger.new(import.meta.filename, "workers");

/**
 * Wraps a protocol definition and a communication port into a properly
 * typed communication channel.
 */
export class Channel {
  /** Create receiving end of the channel (i.e. handling messages `toWorker`). */
  static rx<To, From>(protocol: LousyProtocol<To, From>, port: Port): Rx<To, From> {
    return Channel.new(protocol, port);
  }

  /** Create transmitting end of the channel (i.e. handling messages `fromWorker`). */
  static tx<To, From>(protocol: LousyProtocol<To, From>, port: Port): Tx<To, From> {
    const { name, toWorker, fromWorker } = protocol;
    return Channel.new({ name, toWorker: fromWorker, fromWorker: toWorker }, port);
  }

  static new<To, From>(protocol: LousyProtocol<To, From>, port: Port): Handlers<To> & Senders<From> {
    const channel = new Channel(port);
    // biome-ignore lint/suspicious/noExplicitAny: we dynamically add methods, so that's expected
    const untyped = channel as any;

    // create handlers for incoming requests
    for (const [k, val] of Object.entries(protocol.toWorker)) {
      const key = `${protocol.name}:${String(k)}`;
      if (isMessageCodecs(val)) {
        // NOTE: has to match `Handlers` type definition.
        const typedKey: HandlerKey<string> = `setOn${capitalize(k)}`;
        untyped[typedKey] = channel._createRequestHandler(key, val);
      } else {
        throw new Error(`${key} does not contain message codecs.`);
      }
    }

    // create sender methods for outgoing requests
    for (const [k, val] of Object.entries(protocol.fromWorker)) {
      const key = `${protocol.name}:${String(k)}`;
      if (isMessageCodecs(val)) {
        // NOTE: has to match `Senders` type definition.
        const typedKey: SenderKey<string> = `send${capitalize(k)}`;
        untyped[typedKey] = channel._createSender(key, val);
      } else {
        throw new Error(`${key} does not contain message codecs.`);
      }
    }

    return untyped;
  }

  private nextResponseId = 0;
  private readonly pendingPromises: Set<(err: Error) => void> = new Set();

  private constructor(private readonly port: Port) {
    // add general error handler that will reject all pending promises.
    port.onClose((e: Error) => {
      for (const pending of this.pendingPromises) {
        pending(e);
      }
      this.pendingPromises.clear();
    });
  }

  _createRequestHandler(key: string, val: MessageCodecs<unknown, unknown>) {
    let isAttached = false;

    return (handler: (req: unknown) => Promise<unknown>) => {
      check`${isAttached === false} handler for ${key} can be added only once!`;
      isAttached = true;

      // listen to request incoming to worker
      this.port.on(key, val.request, async ({ responseId, data }) => {
        try {
          // handle them
          const response = await handler(data);

          // and send response back on dedicated event
          this.port.postMessage(responseId, val.response, {
            responseId,
            data: response,
          });
        } catch (e) {
          logger.error`Error while handling ${key} (${responseId}): ${e}`;
          throw e;
        }
      });
    };
  }

  _createSender(key: string, val: MessageCodecs<unknown, unknown>) {
    return (data: unknown): Promise<unknown> => {
      this.nextResponseId++;
      const responseId = `${key}:${this.nextResponseId}`;

      return new Promise((resolve, reject) => {
        this.pendingPromises.add(reject);
        // attach response listener first
        this.port.once(responseId, val.response, (msg) => {
          // we got response, so will resolve
          this.pendingPromises.delete(reject);

          resolve(msg.data);
        });

        // send message to the port
        this.port.postMessage(key, val.request, {
          responseId,
          data,
        });
      });
    };
  }
}

function capitalize<T extends string>(k: T): Capitalize<T> {
  if (k.length === 0) {
    return k as Capitalize<T>;
  }
  return (k.charAt(0).toUpperCase() + k.slice(1)) as Capitalize<T>;
}

function isMessageCodecs(val: unknown): val is MessageCodecs<unknown, unknown> {
  return val !== null && typeof val === "object" && "request" in val && "response" in val;
}
