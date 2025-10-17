import { EventEmitter } from "node:events";
import type { Codec } from "@typeberry/codec";

/**
 * Our specific message envelope.
 *
 * Since we will be implementing request-response protocol,
 * we include an extra field of `responseId` event that
 * should be used to listen to responses (if expected).
 */
export type Envelope<T> = {
  responseId: string;
  data: T;
};

/**
 * Message passing abstraction using JAM-codec for serialization (when necessary).
 *
 * Can be used to communicate between worker threads.
 */
export interface Port {
  /** Attach a callback to be triggered when the port is being closed (via error or not). */
  onClose(callback: (e: Error) => void): void;

  /**
   * Attach event listener for particular event.
   *
   * Returns a function that can be called to unsubscribe.
   */
  on<T>(event: string, codec: Codec<T>, callback: (msg: Envelope<T>) => void): () => void;

  /**
   * Attach one-time event listener for particular event.
   *
   * Returns a function that can be called to unsubscribe.
   */
  once<T>(event: string, codec: Codec<T>, callback: (msg: Envelope<T>) => void): () => void;

  /** Post a message to the port that should be received on the other end. */
  postMessage<T>(event: string, codec: Codec<T>, msg: Envelope<T>): void;

  /** Destroy the communication channel. */
  close(): void;
}

/**
 * A message-passing port that is directly connected to another end.
 *
 * Direct connection means, that both `tx` and `rx` exist in the same worker thread,
 * so there is no need for any serialization - we simply pass the data.
 */
export class DirectPort implements Port {
  /** Create a pair of symmetrical inter-connected ports. */
  static pair(): [DirectPort, DirectPort] {
    const events = new EventEmitter();
    return [new DirectPort(events), new DirectPort(events)];
  }

  private constructor(private readonly events: EventEmitter) {}

  onClose(callback: (e: Error) => void): void {
    this.events.on("error", callback);
  }

  on<T>(event: string, _codec: Codec<T>, callback: (msg: Envelope<T>) => void): () => void {
    const trigger = (args: unknown) => {
      // we simply cast the args, since there is no encoding involved.
      callback(args as Envelope<T>);
    };
    this.events.on(event, trigger);

    return () => {
      this.events.off(event, trigger);
    };
  }

  once<T>(event: string, _codec: Codec<T>, callback: (msg: Envelope<T>) => void): () => void {
    const trigger = (args: unknown) => {
      // we simply cast the args, since there is no encoding involved.
      callback(args as Envelope<T>);
    };
    this.events.once(event, trigger);

    return () => {
      this.events.off(event, trigger);
    };
  }

  postMessage<T>(event: string, _codec: Codec<T>, msg: Envelope<T>): void {
    this.events.emit(event, msg);
  }

  close() {
    this.events.emit("error", new Error("closing channel"));
    this.events.removeAllListeners();
  }
}
