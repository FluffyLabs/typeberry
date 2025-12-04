import { Logger } from "@typeberry/logger";
import {
  type InputOf,
  JSON_RPC_VERSION,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type JsonRpcSubscriptionNotification,
  type MethodName,
  type MethodWithNoArgsName,
  type OutputOf,
  type SchemaMapUnknown,
  SUBSCRIBABLE_METHODS,
  type SubscribableMethodName,
  validation,
} from "@typeberry/rpc-validation";
import { EventEmitter } from "eventemitter3";
import WebSocket from "ws";

export interface Subscription<M extends SubscribableMethodName> {
  id: string;
  method: M;
  eventEmitter: SubscriptionEventEmitter;
}

type SubscriptionEventMap = {
  data: [unknown];
  error: [unknown];
  end: [];
};

class SubscriptionEventEmitter extends EventEmitter<SubscriptionEventMap> {
  constructor(readonly unsubscribe: () => Promise<void>) {
    super();
  }
}

const logger = Logger.new("rpc");

export class RpcClient {
  private ws: WebSocket;
  private messageQueue: Map<number, (response: JsonRpcResponse) => void> = new Map();
  private subscriptions: Map<string, Subscription<SubscribableMethodName>> = new Map();
  private nextId = 1;
  private connectionPromise: Promise<void>;

  constructor(url: string) {
    this.ws = new WebSocket(url);
    this.connectionPromise = new Promise((resolve) => {
      this.ws.once("open", () => {
        logger.info`Connected to server`;
        resolve();
      });
    });
    this.setupWebSocket();
  }

  private setupWebSocket(): void {
    this.ws.on("message", (data: string) => {
      const response: JsonRpcResponse | JsonRpcSubscriptionNotification = JSON.parse(data);

      // todo [seko] this block of ifs shall be made cleaner once there's zod validation in place for the client
      if (
        !("id" in response) &&
        "params" in response &&
        "subscriptionId" in response.params &&
        "result" in response.params
      ) {
        const { subscriptionId, result } = response.params;
        const subscription = this.subscriptions.get(subscriptionId);

        if (subscription !== undefined) {
          subscription.eventEmitter.emit("data", result);
        }
      } else if (
        !("id" in response) &&
        "params" in response &&
        "subscriptionId" in response.params &&
        "error" in response.params
      ) {
        const { subscriptionId, error } = response.params;
        const subscription = this.subscriptions.get(subscriptionId);

        if (subscription !== undefined) {
          subscription.eventEmitter.emit("error", error);
        }
      } else if ("id" in response && typeof response.id === "number") {
        const callback = this.messageQueue.get(response.id);

        if (callback !== undefined) {
          callback(response);
          this.messageQueue.delete(response.id);
        }
      }
    });

    this.ws.on("error", (error) => {
      logger.error`WebSocket error: ${error}`;
    });

    this.ws.on("close", () => {
      logger.info`Disconnected from server`;
    });
  }

  async waitForConnection(): Promise<void> {
    return this.connectionPromise;
  }

  async call<M extends MethodWithNoArgsName>(method: M, params?: InputOf<M>): Promise<OutputOf<M>>;
  async call<M extends MethodName>(method: M, params: InputOf<M>): Promise<OutputOf<M>>;
  async call<M extends MethodName>(method: M, params?: InputOf<M>): Promise<OutputOf<M>> {
    if (!(method in validation.schemas)) {
      throw new Error(`Method "${method}" not found. Request was not sent.`);
    }

    const { input } = validation.schemas[method] as SchemaMapUnknown[M];

    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const request: JsonRpcRequest = {
        jsonrpc: JSON_RPC_VERSION,
        method,
        params: input.encode(params ?? []),
        id,
      };

      this.messageQueue.set(id, (response: JsonRpcResponse) => {
        if ("error" in response) {
          reject(response.error);
        } else {
          const { output } = validation.schemas[method];
          const parseResult = output.safeParse(response.result);
          if (parseResult.success === false) {
            reject(
              new Error(`Received an invalid response for method "${method}": ${JSON.stringify(response.result)}`),
            );
            return;
          }
          resolve(parseResult.data);
        }
      });

      this.ws.send(JSON.stringify(request));
    });
  }

  async subscribe<M extends SubscribableMethodName>(method: M, params: InputOf<M>): Promise<SubscriptionEventEmitter> {
    const subscriptionId = await this.call(method, params);
    const eventEmitter = new SubscriptionEventEmitter(() => this.unsubscribe(subscriptionId));
    this.subscriptions.set(subscriptionId, { id: subscriptionId, method, eventEmitter });
    return eventEmitter;
  }

  private async unsubscribe(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription === undefined) {
      throw new Error("Subscription not found. Unsubscribe request was not sent.");
    }

    const unsubscribeMethod = SUBSCRIBABLE_METHODS[subscription.method];
    if (unsubscribeMethod === undefined) {
      throw new Error(
        `Missing unsubscribe method mapping for "${subscription.method}". Unsubscribe request was not sent.`,
      );
    }
    const result = await this.call(unsubscribeMethod, [subscriptionId]);

    if (result === true) {
      this.subscriptions.delete(subscriptionId);
    } else {
      throw new Error("Server failed to terminate subscription.");
    }
  }

  close(): void {
    this.ws.close();
  }

  getSocket(): WebSocket {
    return this.ws;
  }
}
