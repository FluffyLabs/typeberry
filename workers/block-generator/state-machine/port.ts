import { MessagePort, TransferListItem } from "node:worker_threads";
import { EventEmitter } from 'node:events';
import { check } from '@typeberry/utils';
import {Message} from "./message";

export class TypedPort {
  public listeners = new EventEmitter();
  private responseListeners = new EventEmitter();

  private messageId = 0;

  constructor(private port: MessagePort) {
    port.on('message', (msg) => {
      try {
        this.dispatchPortMessage(msg);
      } catch (e) {
        console.error(`[${this.constructor.name}] Failed to dispatch a message: ${e}`, msg);
        throw e;
      }
    });
  }

  dispatchPortMessage(msg: any) {
    if (msg.kind && msg.id && msg.name && 'data' in msg && msg.localState) {
      switch (msg.kind) {
        case 'response':
          this.responseListeners.emit(reqEvent(msg.id), null, msg.data, msg.name, msg.localState, msg);
          break;
        case 'message':
          this.listeners.emit('message', msg.name, msg.data, msg.localState, msg);
          break;
        case 'request':
          this.listeners.emit('request', msg.name, msg.data, msg.localState, msg);
        break;
        case 'subscription':
          throw new Error('unimplemented');
        case 'subscribe':
          throw new Error('unimplemented');
        default:
          throw new Error('Unexpected message');
      }
    } else {
      throw new Error(`Invalid message: ${JSON.stringify(msg)}.`);
    }
  }

  private cleanup(reason: string) {
    // resolve all pending requests with an error.
    const responseListeners = this.responseListeners.eventNames();
    for (const ev in responseListeners) {
      this.responseListeners.emit(ev, new Error(`port is ${reason}`));
    }
  }

  close() {
    this.cleanup("closing");
    this.listeners.removeAllListeners();
    this.port.close();
  }

  prepareRequest<TRes>(localState: string, name: string, data: unknown): [Message, Promise<TRes>] {
    this.messageId += 1;

    const promise = new Promise<TRes>((resolve, reject) => {
      this.responseListeners.once(reqEvent(this.messageId), (err, result) => {
        return err ? reject(err) : resolve(result);
      });
    });

    return [{
      kind: 'request',
      id: this.messageId,
      name,
      localState,
      data,
    }, promise]
  }

  sendMessage(localState: string, name: string, data: unknown, transferList?: TransferListItem[]) {
    this.messageId += 1;
    this.postMessage({
      kind: 'message',
      name,
      id: this.messageId,
      localState,
      data,
    }, transferList)
  }

  async request<TRes>(localState: string, name: string, data: unknown, transferList?: TransferListItem[]) {
    const [request, promise] = this.prepareRequest<TRes>(localState, name, data);
    this.postMessage(request, transferList);
    return promise;
  }

  respond(localState: string, request: Message, data: unknown) {
    check(request.kind === 'request');
    this.postMessage({
      kind: 'response',
      id: request.id,
      name: request.name,
      data,
      localState,
    });
  }

  private postMessage(msg: Message, transferList?: TransferListItem[]) {
    try {
      this.port.postMessage(msg, transferList);
    } catch (e) {
      console.error(`[${this.constructor.name}] Failed to post a message: ${e}`, msg);
      throw e;
    }
  }
}

function reqEvent(id: number) {
  return `req:${id}`;
}
