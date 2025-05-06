import WebSocket from "ws";
import type { JsonRpcRequest, JsonRpcResponse } from "../src/types";

class RpcClient {
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
      const response: JsonRpcResponse = JSON.parse(data.toString());
      const callback = this.messageQueue.get(response.id as number);

      if (callback) {
        callback(response);
        this.messageQueue.delete(response.id as number);
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

  async call(method: string, params?: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const request: JsonRpcRequest = {
        jsonrpc: "2.0",
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

async function main() {
  const client = new RpcClient("ws://localhost:19800");

  try {
    await client.waitForConnection();

    console.info("Testing echo method...");
    const echoResult = await client.call("echo", { message: "Hello, server!" });
    console.info("Echo result:", echoResult);

    console.info("\nTesting non-existent method...");
    try {
      await client.call("nonExistentMethod", { foo: "bar" });
    } catch (error) {
      console.info("Expected error:", error);
    }

    console.info("\nTesting invalid parameters...");
    try {
      await client.call("echo", { invalid: "params" });
    } catch (error) {
      console.info("Expected error:", error);
    }
  } catch (error) {
    console.error("Test failed:", error);
  } finally {
    client.close();
  }
}

main();
