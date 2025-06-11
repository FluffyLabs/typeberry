import WebSocket from "ws";
import type { JsonRpcRequest, JsonRpcResponse, JsonRpcSubscriptionNotification } from "./types.js";
import { JSON_RPC_VERSION } from "./types.js";

export class RpcClient {
  private ws: WebSocket;
  private messageQueue: Map<number, (response: JsonRpcResponse) => void> = new Map();
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
    this.ws.on("message", (data: Buffer) => {
      const response: JsonRpcResponse | JsonRpcSubscriptionNotification = JSON.parse(data.toString());

      if (!("id" in response) && "params" in response) {
        console.info(`sub[${response.params[0]}]:`, response.params[1]);
      } else if (typeof response.id === "number") {
        const callback = this.messageQueue.get(response.id);

        if (callback !== undefined) {
          callback(response);
          this.messageQueue.delete(response.id);
        }
      } else {
        console.error("Unexpected message from server:", response);
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

  close(): void {
    this.ws.close();
  }
}
