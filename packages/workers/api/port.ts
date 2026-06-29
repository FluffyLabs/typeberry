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

type PortState = {
  events: EventEmitter;
  pendingMessages: Map<string, Envelope<unknown>[]>;
};

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
    const left = createPortState();
    const right = createPortState();
    return [new DirectPort(left, right), new DirectPort(right, left)];
  }

  private constructor(
    private readonly inbound: PortState,
    private readonly outbound: PortState,
  ) {}

  onClose(callback: (e: Error) => void): void {
    this.inbound.events.on("error", callback);
  }

  on<T>(event: string, _codec: Codec<T>, callback: (msg: Envelope<T>) => void): () => void {
    const trigger = (args: unknown) => {
      // we simply cast the args, since there is no encoding involved.
      callback(args as Envelope<T>);
    };
    this.inbound.events.on(event, trigger);
    this.flushPending(event, trigger);

    return () => {
      this.inbound.events.off(event, trigger);
    };
  }

  once<T>(event: string, _codec: Codec<T>, callback: (msg: Envelope<T>) => void): () => void {
    const trigger = (args: unknown) => {
      // we simply cast the args, since there is no encoding involved.
      callback(args as Envelope<T>);
    };

    const pending = this.inbound.pendingMessages.get(event);
    const pendingMessage = pending?.shift();
    if (pending?.length === 0) {
      this.inbound.pendingMessages.delete(event);
    }
    if (pendingMessage !== undefined) {
      trigger(pendingMessage);
      return () => {};
    }

    this.inbound.events.once(event, trigger);

    return () => {
      this.inbound.events.off(event, trigger);
    };
  }

  postMessage<T>(event: string, _codec: Codec<T>, msg: Envelope<T>): void {
    if (this.outbound.events.listenerCount(event) === 0) {
      this.queuePending(event, msg);
      return;
    }
    this.outbound.events.emit(event, msg);
  }

  close() {
    this.closeState(this.inbound);
    this.closeState(this.outbound);
  }

  private queuePending(event: string, msg: Envelope<unknown>) {
    const pending = this.outbound.pendingMessages.get(event) ?? [];
    pending.push(msg);
    this.outbound.pendingMessages.set(event, pending);
  }

  private flushPending(event: string, trigger: (args: unknown) => void) {
    const pending = this.inbound.pendingMessages.get(event);
    if (pending === undefined) {
      return;
    }
    this.inbound.pendingMessages.delete(event);
    for (const msg of pending) {
      trigger(msg);
    }
  }

  private closeState(state: PortState) {
    state.events.emit("error", new Error("closing channel"));
    state.events.removeAllListeners();
    state.pendingMessages.clear();
  }
}

function createPortState(): PortState {
  return {
    events: new EventEmitter(),
    pendingMessages: new Map<string, Envelope<unknown>[]>(),
  };
}
