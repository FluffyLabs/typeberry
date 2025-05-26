import type WebSocket from "ws";
import type { RpcServer } from "./server";
import {
  JSON_RPC_VERSION,
  type JsonRpcSubscriptionNotification,
  RpcError,
  type Subscription,
  type SubscriptionId,
} from "./types";

const POLL_INTERVAL_MS = 1000;

export const SUBSCRIBE_METHOD_MAP = new Map<string, string>([
  ["subscribeBestBlock", "bestBlock"],
  ["subscribeFinalizedBlock", "finalizedBlock"],
  ["subscribeServiceData", "serviceData"],
  ["subscribeServicePreimage", "servicePreimage"],
  ["subscribeServiceRequest", "serviceRequest"],
  ["subscribeServiceValue", "serviceValue"],
  ["subscribeStatistics", "statistics"],
]);

export const UNSUBSCRIBE_METHOD_WHITELIST = new Set<string>([
  "unsubscribeBestBlock",
  "unsubscribeFinalizedBlock",
  "unsubscribeServiceData",
  "unsubscribeServicePreimage",
  "unsubscribeServiceRequest",
  "unsubscribeServiceValue",
  "unsubscribeStatistics",
]);

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
      try {
        const result = await this.server.callMethod(subscription.method, subscription.params);
        const lastResult = this.lastResults.get(subscriptionId);

        if (JSON.stringify(result) !== lastResult) {
          const notification: JsonRpcSubscriptionNotification = {
            jsonrpc: JSON_RPC_VERSION,
            method: subscription.method,
            params: [subscriptionId, result],
          };

          subscription.ws.send(JSON.stringify(notification));
          this.lastResults.set(subscriptionId, JSON.stringify(result));
        }
      } catch (error) {
        this.server.getLogger().error(`Error polling subscription ${subscriptionId}:`);
        if (error instanceof Error) {
          this.server.getLogger().error(error.toString());
        } else {
          this.server.getLogger().error(JSON.stringify(error));
        }
      }
    }
  }

  subscribe(ws: WebSocket, method: string, params?: unknown[]): SubscriptionId {
    const mappedMethod = SUBSCRIBE_METHOD_MAP.get(method);
    if (mappedMethod === undefined) {
      throw new RpcError(-32601, `Method not found: ${method}`);
    }

    const id = this.nextId++;
    const idHex = `0x${id.toString(16)}`;

    this.subscriptions.set(idHex, { ws, method: mappedMethod, params });

    ws.on("close", () => {
      this.unsubscribe(idHex);
    });

    return idHex;
  }

  unsubscribe(id: SubscriptionId): boolean {
    this.lastResults.delete(id);
    return this.subscriptions.delete(id);
  }

  destroy(): void {
    clearInterval(this.pollInterval);
  }
}
