import type WebSocket from "ws";
import type { RpcServer } from "./server.js";
import type {
  InputOf,
  JsonRpcSubscriptionNotification,
  MethodName,
  SubscribeMethodName,
  Subscription,
  SubscriptionId,
  UnsubscribeMethodName,
} from "./types.js";
import { JSON_RPC_VERSION } from "./validation.js";

const POLL_INTERVAL_MS = 1000;

export const SUBSCRIBE_METHOD_MAP: Record<
  SubscribeMethodName,
  { handler: MethodName; unsubscribe: UnsubscribeMethodName }
> = {
  subscribeBestBlock: {
    handler: "bestBlock",
    unsubscribe: "unsubscribeBestBlock",
  },
  subscribeFinalizedBlock: {
    handler: "finalizedBlock",
    unsubscribe: "unsubscribeFinalizedBlock",
  },
  subscribeServiceData: {
    handler: "serviceData",
    unsubscribe: "unsubscribeServiceData",
  },
  subscribeServicePreimage: {
    handler: "servicePreimage",
    unsubscribe: "unsubscribeServicePreimage",
  },
  subscribeServiceRequest: {
    handler: "serviceRequest",
    unsubscribe: "unsubscribeServiceRequest",
  },
  subscribeServiceValue: {
    handler: "serviceValue",
    unsubscribe: "unsubscribeServiceValue",
  },
  subscribeStatistics: {
    handler: "statistics",
    unsubscribe: "unsubscribeStatistics",
  },
} as const;

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
        const result = await this.server.callHandler(subscription.method, subscription.params);

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

  subscribe<M extends MethodName>(ws: WebSocket, method: M, params: InputOf<M>): SubscriptionId {
    const id = this.nextId++;
    const idHex = `0x${id.toString(16)}`;

    this.subscriptions.set(idHex, { ws, method, params });

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
