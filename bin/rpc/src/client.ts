import WebSocket from "ws";
import type { JsonRpcRequest, JsonRpcResponse, JsonRpcSubscriptionNotification } from "./types.js";
import { JSON_RPC_VERSION } from "./types.js";

export interface Subscription {
  id: string;
  method: string;
  callback: (data: unknown) => void;
  errorCallback?: (error: unknown) => void;
}

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
        console.info("Connected to server");
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
          subscription.callback(result);
        }
      } else if (
        !("id" in response) &&
        "params" in response &&
        "subscriptionId" in response.params &&
        "error" in response.params
      ) {
        const { subscriptionId, error } = response.params;
        const subscription = this.subscriptions.get(subscriptionId);

        if (subscription !== undefined && subscription.errorCallback !== undefined) {
          subscription.errorCallback(error);
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
      console.error("WebSocket error:", error);
    });

    this.ws.on("close", () => {
      console.info("Disconnected from server");
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
          reject(new Error(response.error.message));
        } else {
          resolve(response.result);
        }
      });

      this.ws.send(JSON.stringify(request));
    });
  }

  async subscribe(
    method: string,
    params: unknown[],
    callback: Subscription["callback"],
    errorCallback?: Subscription["errorCallback"],
  ): Promise<() => Promise<void>> {
    const subscribeMethod = `subscribe${capitalizeFirstLetter(method)}`;
    const result = await this.call(subscribeMethod, params);

    if (Array.isArray(result) && result.length === 1 && typeof result[0] === "string") {
      const subscriptionId = result[0];
      this.subscriptions.set(subscriptionId, { id: subscriptionId, method, callback, errorCallback });
      return async () => await this.unsubscribe(subscriptionId);
    }

    throw new Error("Invalid subscription response");
  }

  private async unsubscribe(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription === undefined) {
      throw new Error("Subscription not found");
    }

    const unsubscribeMethod = `unsubscribe${capitalizeFirstLetter(subscription.method)}`;
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

function capitalizeFirstLetter(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
