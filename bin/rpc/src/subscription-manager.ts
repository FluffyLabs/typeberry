import {
  type GenericHandler,
  JSON_RPC_VERSION,
  type JsonRpcSubscriptionNotification,
  RpcError,
  RpcErrorCode,
  type SubscribableMethodName,
  type Subscription,
  type SubscriptionHandlerApi,
  type SubscriptionId,
} from "@typeberry/rpc-validation";
import type WebSocket from "ws";
import type z from "zod";
import type { RpcServer } from "./server.js";

const POLL_INTERVAL_MS = 1000;

export class SubscriptionManager {
  // biome-ignore lint/suspicious/noExplicitAny: subscriptions must accept generic handlers
  private subscriptions: Map<SubscriptionId, Subscription<any, any>>;
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
        const result = await this.server.callHandler(
          subscription.handler,
          subscription.params,
          subscription.outputSchema,
          subscription.ws,
        );

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

  private subscribe<I, O>(
    ws: WebSocket,
    method: SubscribableMethodName,
    handler: GenericHandler<I, O>,
    outputSchema: z.ZodType<O>,
    params: I,
  ): SubscriptionId {
    const id = this.nextId++;
    const idHex = `0x${id.toString(16)}`;

    this.subscriptions.set(idHex, { ws, method, handler, outputSchema, params });

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
      subscribe: (method, handler, outputSchema, params) => this.subscribe(ws, method, handler, outputSchema, params),
      unsubscribe: (id) => this.unsubscribe(ws, id),
    };
  }

  destroy(): void {
    clearInterval(this.pollInterval);
  }
}
