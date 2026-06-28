import type { Codec } from "@typeberry/codec";
import { EventEmitter } from "eventemitter3";

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
  /** Optional thread id. */
  readonly threadId: number;

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
  readonly threadId = 0;

  /** Create a pair of symmetrical inter-connected ports. */
  static pair(): [DirectPort, DirectPort] {
    const state = {
      events: new EventEmitter(),
      pendingMessages: new Map<string, Envelope<unknown>[]>(),
    };
    return [new DirectPort(state), new DirectPort(state)];
  }

  private constructor(
    private readonly state: {
      events: EventEmitter;
      pendingMessages: Map<string, Envelope<unknown>[]>;
    },
  ) {}

  onClose(callback: (e: Error) => void): void {
    this.state.events.on("error", callback);
  }

  on<T>(event: string, _codec: Codec<T>, callback: (msg: Envelope<T>) => void): () => void {
    const trigger = (args: unknown) => {
      // we simply cast the args, since there is no encoding involved.
      callback(args as Envelope<T>);
    };
    this.state.events.on(event, trigger);
    this.flushPending(event, trigger);

    return () => {
      this.state.events.off(event, trigger);
    };
  }

  once<T>(event: string, _codec: Codec<T>, callback: (msg: Envelope<T>) => void): () => void {
    const trigger = (args: unknown) => {
      // we simply cast the args, since there is no encoding involved.
      callback(args as Envelope<T>);
    };

    const pending = this.state.pendingMessages.get(event);
    const pendingMessage = pending?.shift();
    if (pending?.length === 0) {
      this.state.pendingMessages.delete(event);
    }
    if (pendingMessage !== undefined) {
      trigger(pendingMessage);
      return () => {};
    }

    this.state.events.once(event, trigger);

    return () => {
      this.state.events.off(event, trigger);
    };
  }

  postMessage<T>(event: string, _codec: Codec<T>, msg: Envelope<T>): void {
    if (this.state.events.listenerCount(event) === 0) {
      this.queuePending(event, msg);
      return;
    }
    this.state.events.emit(event, msg);
  }

  close() {
    this.state.events.emit("error", new Error("closing channel"));
    this.state.events.removeAllListeners();
    this.state.pendingMessages.clear();
  }

  private queuePending(event: string, msg: Envelope<unknown>) {
    const pending = this.state.pendingMessages.get(event) ?? [];
    pending.push(msg);
    this.state.pendingMessages.set(event, pending);
  }

  private flushPending(event: string, trigger: (args: unknown) => void) {
    const pending = this.state.pendingMessages.get(event);
    if (pending === undefined) {
      return;
    }
    this.state.pendingMessages.delete(event);
    for (const msg of pending) {
      trigger(msg);
    }
  }
}
