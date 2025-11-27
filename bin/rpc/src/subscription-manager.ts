import type WebSocket from "ws";
import type { RpcServer } from "./server.js";
import {
  type InputOf,
  type JsonRpcSubscriptionNotification,
  type MethodName,
  RpcError,
  RpcErrorCode,
  type Subscription,
  type SubscriptionHandlerApi,
  type SubscriptionId,
} from "./types.js";
import { JSON_RPC_VERSION } from "./validation.js";

const POLL_INTERVAL_MS = 1000;

export const SUBSCRIBABLE_METHODS = {
  subscribeBestBlock: "unsubscribeBestBlock",
  subscribeFinalizedBlock: "unsubscribeFinalizedBlock",
  subscribeServiceData: "unsubscribeServiceData",
  subscribeServicePreimage: "unsubscribeServicePreimage",
  subscribeServiceRequest: "unsubscribeServiceRequest",
  subscribeServiceValue: "unsubscribeServiceValue",
  subscribeStatistics: "unsubscribeStatistics",
} as const satisfies Partial<Record<MethodName, MethodName>>;

export class SubscriptionManager {
  private subscriptions: Map<SubscriptionId, Subscription>;
  private lastResults: Map<SubscriptionId, string>;
  private pollInterval: NodeJS.Timeout;
  private nextId: number;

  constructor(private server: RpcServer) {
    this.subscriptions = new Map();
    this.lastResults = new Map();
    this.pollInterval = setInterval(() => this.pollSubscriptions(), POLL_INTERVAL_MS);
    this.nextId = 0;
  }

  private async pollSubscriptions(): Promise<void> {
    for (const [subscriptionId, subscription] of this.subscriptions) {
      const lastResult = this.lastResults.get(subscriptionId);
      let notificationString: string;

      try {
        const result = await this.server.callHandler(subscription.method, subscription.params, subscription.ws);

        const notification: JsonRpcSubscriptionNotification = {
          jsonrpc: JSON_RPC_VERSION,
          method: subscription.method,
          params: { subscriptionId, result },
        };

        notificationString = JSON.stringify(notification);
      } catch (error) {
        const notification: JsonRpcSubscriptionNotification = {
          jsonrpc: JSON_RPC_VERSION,
          method: subscription.method,
          params: { subscriptionId, error: `${error}` },
        };

        notificationString = JSON.stringify(notification);
      }

      if (notificationString !== lastResult) {
        subscription.ws.send(notificationString);
        this.lastResults.set(subscriptionId, notificationString);
      }
    }
  }

  private subscribe<M extends MethodName>(ws: WebSocket, method: M, params: InputOf<M>): SubscriptionId {
    const id = this.nextId++;
    const idHex = `0x${id.toString(16)}`;

    this.subscriptions.set(idHex, { ws, method, params });

    ws.on("close", () => {
      if (this.subscriptions.has(idHex)) {
        this.unsubscribe(ws, idHex);
      }
    });

    return idHex;
  }

  private unsubscribe(ws: WebSocket, id: SubscriptionId): boolean {
    if (this.subscriptions.get(id)?.ws !== ws) {
      throw new RpcError(RpcErrorCode.Other, "Subscription not found.");
    }
    this.lastResults.delete(id);
    return this.subscriptions.delete(id);
  }

  getHandlerApi(ws: WebSocket): SubscriptionHandlerApi {
    return {
      subscribe: (method, params) => this.subscribe(ws, method, params),
      unsubscribe: (id) => this.unsubscribe(ws, id),
    };
  }

  destroy(): void {
    clearInterval(this.pollInterval);
  }
}
