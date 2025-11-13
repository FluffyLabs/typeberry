import { EventEmitter } from "node:events";
import { Logger } from "@typeberry/logger";
import WebSocket from "ws";
import { SUBSCRIBE_METHOD_MAP } from "./subscription-manager.js";
import type { JsonRpcRequest, JsonRpcResponse, JsonRpcSubscriptionNotification } from "./types.js";
import { JSON_RPC_VERSION } from "./types.js";

export interface Subscription {
  id: string;
  method: string;
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

const logger = Logger.new(import.meta.filename, "rpc");

export class RpcClient {
  private ws: WebSocket;
  private messageQueue: Map<number, (response: JsonRpcResponse) => void> = new Map();
  private subscriptions: Map<string, Subscription> = new Map();
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

  async call(method: string, params?: unknown[]): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const request: JsonRpcRequest = {
        jsonrpc: JSON_RPC_VERSION,
        method,
        params,
        id,
      };

      this.messageQueue.set(id, (response: JsonRpcResponse) => {
        if ("error" in response) {
          reject(response.error);
        } else {
          resolve(response.result);
        }
      });

      this.ws.send(JSON.stringify(request));
    });
  }

  async subscribe(method: string, params: unknown[]): Promise<SubscriptionEventEmitter> {
    const result = await this.call(method, params);

    if (Array.isArray(result) && result.length === 1 && typeof result[0] === "string") {
      const subscriptionId = result[0];
      const eventEmitter = new SubscriptionEventEmitter(() => this.unsubscribe(subscriptionId));
      this.subscriptions.set(subscriptionId, { id: subscriptionId, method, eventEmitter });
      return eventEmitter;
    }

    throw new Error("Invalid subscription response");
  }

  private async unsubscribe(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription === undefined) {
      throw new Error("Subscription not found");
    }

    const [_, unsubscribeMethod] = SUBSCRIBE_METHOD_MAP.get(subscription.method) ?? [];
    if (unsubscribeMethod === undefined) {
      throw new Error(`Missing unsubscribe method mapping for ${subscription.method}`);
    }

    const result = await this.call(unsubscribeMethod, [subscriptionId]);

    if (Array.isArray(result) && result.length === 1 && typeof result[0] === "boolean") {
      if (result[0] === true) {
        this.subscriptions.delete(subscriptionId);
      } else {
        throw new Error("Couldn't terminate subscription on server because it was not found.");
      }

      return;
    }

    throw new Error("Invalid unsubscribe response");
  }

  close(): void {
    this.ws.close();
  }

  getSocket(): WebSocket {
    return this.ws;
  }
}
