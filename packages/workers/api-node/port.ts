import EventEmitter from "node:events";
import { type MessagePort, type Transferable, threadId } from "node:worker_threads";
import { type Codec, Decoder, Encoder } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import { Logger } from "@typeberry/logger";
import { check } from "@typeberry/utils";
import type { Envelope, Port } from "@typeberry/workers-api/port.js";

export type Message = {
  eventName: string;
  responseId: string;
  data: Uint8Array;
};
const MESSAGE_KEYS: (keyof Message)[] = ["eventName", "responseId", "data"];

const logger = Logger.new(import.meta.filename, "workers/api");

export class ThreadPort implements Port {
  public readonly threadId = threadId;
  private readonly events = new EventEmitter();

  public constructor(
    private readonly spec: ChainSpec,
    private readonly port: MessagePort,
  ) {
    this.port.on("message", (input: unknown) => {
      if (!isMessage(input)) {
        logger.error`Received a malformed data from another thread: ${input}`;
        return;
      }

      const { eventName, responseId, data } = input;
      check`${this.events.listeners(eventName).length > 0} No listeners for received event ${eventName}!`;
      this.events.emit(eventName, responseId, data);
    });
  }

  close(): void {
    this.port.close();
  }

  private createListener<T>(codec: Codec<T>, callback: (msg: Envelope<T>) => void) {
    return (responseId: string, data: Uint8Array) => {
      let decoded: T;
      try {
        decoded = Decoder.decodeObject(codec, data, this.spec);
      } catch (e) {
        logger.error`Unable to decode expected from thread: ${"name" in codec ? codec.name : codec}: ${e}`;
        return;
      }
      try {
        callback({ responseId, data: decoded });
      } catch (e) {
        logger.error`Error while processing thread message: ${e}`;
        throw e;
      }
    };
  }

  onClose(callback: (e: Error) => void): void {
    this.port.on("error", callback);
  }

  on<T>(event: string, codec: Codec<T>, callback: (msg: Envelope<T>) => void): () => void {
    const listener = this.createListener(codec, callback);
    this.events.on(event, listener);

    return () => {
      this.events.off(event, listener);
    };
  }

  once<T>(event: string, codec: Codec<T>, callback: (msg: Envelope<T>) => void): () => void {
    const listener = this.createListener(codec, callback);
    this.events.once(event, listener);

    return () => {
      this.events.off(event, listener);
    };
  }

  postMessage<T>(event: string, codec: Codec<T>, msg: Envelope<T>): void {
    const encoded = Encoder.encodeObject(codec, msg.data, this.spec);
    const message: Message = {
      eventName: event,
      responseId: msg.responseId,
      data: encoded.raw,
    };
    // casting to transferable is safe here, since we know that encoder
    // always returns owned uint8arrays.
    this.port.postMessage(message, [encoded.raw.buffer as unknown as Transferable]);
  }
}

function isMessage(data: unknown): data is Message {
  const isObject = data !== null && typeof data === "object";
  if (!isObject) {
    return false;
  }

  for (const k of MESSAGE_KEYS) {
    if (!(k in data)) {
      return false;
    }
  }

  return true;
}
