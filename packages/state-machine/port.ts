import { EventEmitter } from "node:events";
import type { MessagePort, TransferListItem } from "node:worker_threads";
import { Logger } from "@typeberry/logger";
import { check } from "@typeberry/utils";
import { type Message, isValidMessage } from "./message";

const MAX_ID = 2 ** 32;
const logger = Logger.new(__filename, "state-machine/port");

/**
 * Wrapper around `MessagePort` to communicate between workers or threads.
 *
 * Note this type is only used externall, since the users should only interact
 * directly with the state machine.
 *
 * See also ['TypedChannel'].
 */
export class TypedPort {
  /**
   * A stream of received messages that should be handled externally.
   *
   * Events emitted: 'signal', 'request', 'subscribe'.
   */
  public readonly listeners = new EventEmitter();

  /** In-flight requests awaiting response. */
  private readonly responseListeners = new EventEmitter();
  private messageId = 0;

  constructor(private port: MessagePort) {
    port.on("message", (msg) => {
      try {
        this.dispatchPortMessage(msg);
      } catch (e) {
        logger.error(`[${this.constructor.name}] Failed to dispatch a message: ${e}: ${JSON.stringify(msg)}`);
        throw e;
      }
    });
  }

  /**
   * Send a request to the worker and get a response `Promise`.
   */
  async sendRequest<TRes>(localState: string, name: string, data: unknown, transferList?: TransferListItem[]) {
    const [request, promise] = this.prepareRequest<TRes>(localState, name, data);
    this.postMessage(request, transferList);
    return promise;
  }

  /**
   * Send a signal to the worker.
   */
  sendSignal(localState: string, name: string, data: unknown, transferList?: TransferListItem[]) {
    this.messageId = (this.messageId + 1) % MAX_ID;
    this.messageId >>>= 0;

    this.postMessage(
      {
        kind: "signal",
        name,
        id: this.messageId,
        localState,
        data,
      },
      transferList,
    );
  }

  /**
   * Just prepare a request object and response promise without sending it over the channel.
   */
  prepareRequest<TRes>(localState: string, name: string, data: unknown): [Message, Promise<TRes>] {
    this.messageId += 1;

    const promise = new Promise<TRes>((resolve, reject) => {
      this.responseListeners.once(reqEvent(this.messageId), (err, result) => {
        return err ? reject(err) : resolve(result);
      });
    });

    return [
      {
        kind: "request",
        id: this.messageId,
        name,
        localState,
        data,
      },
      promise,
    ];
  }

  /**
   * Send a response given the worker that has previously requested something.
   */
  respond(localState: string, request: Message, data: unknown) {
    check(request.kind === "request");
    this.postMessage({
      kind: "response",
      id: request.id,
      name: request.name,
      data,
      localState,
    });
  }

  /**
   * Close this communication channel and resolve all pending requests to error.
   */
  close() {
    this.cleanup("closing");
    this.listeners.removeAllListeners();
    this.port.close();
  }

  private postMessage(msg: Message, transferList?: TransferListItem[]) {
    try {
      this.port.postMessage(msg, transferList);
    } catch (e) {
      logger.error(`[${this.constructor.name}] Failed to post a message: ${e}: ${JSON.stringify(msg)}`);
      throw e;
    }
  }

  private dispatchPortMessage(msg: unknown) {
    if (!isValidMessage(msg)) {
      throw new Error(`Invalid message: ${JSON.stringify(msg)}.`);
    }

    switch (msg.kind) {
      case "response":
        check(this.responseListeners.eventNames().indexOf(reqEvent(msg.id)) !== -1);
        this.responseListeners.emit(reqEvent(msg.id), null, msg.data, msg.name, msg.localState, msg);
        break;
      case "signal":
        this.listeners.emit("signal", msg.name, msg.data, msg.localState, msg);
        break;
      case "request":
        this.listeners.emit("request", msg.name, msg.data, msg.localState, msg);
        break;
      case "subscription":
        throw new Error("unimplemented");
      case "subscribe":
        throw new Error("unimplemented");
      default:
        throw new Error(`Unexpected message: "${msg.kind}"`);
    }
  }

  private cleanup(reason: string) {
    // resolve all pending requests with an error.
    const responseListeners = this.responseListeners.eventNames();
    for (const ev in responseListeners) {
      this.responseListeners.emit(ev, new Error(`port is ${reason}`));
    }
  }
}

/**
 * Convert message id into an event name.
 */
function reqEvent(id: number) {
  return `req:${id}`;
}
