import WebSocket from "ws";
import type { JsonRpcRequest, JsonRpcResponse, JsonRpcSubscriptionNotification } from "../src/types";
import { JSON_RPC_VERSION } from "../src/types";

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
      const response: JsonRpcResponse | JsonRpcSubscriptionNotification = JSON.parse(data.toString());

      if ("params" in response) {
        console.info(`sub[${response.params[0]}]:`, response.params[1]);
      } else if (typeof response.id === "number") {
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

  async call(method: string, params?: unknown[]): Promise<unknown[] | null> {
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

async function main() {
  const client = new RpcClient("ws://localhost:19800");

  await client.waitForConnection();

  console.info("Testing bestBlock method...");
  const bestBlockResult = await client.call("bestBlock");
  console.info("bestBlock result:", bestBlockResult);

  if (bestBlockResult !== null) {
    console.info("Testing parent method...");
    const parentResult = await client.call("parent", [bestBlockResult[0]]);
    console.info("parent result:", parentResult);

    console.info("Testing stateRoot method...");
    const stateRootResult = await client.call("stateRoot", [bestBlockResult[0]]);
    console.info("stateRoot result:", stateRootResult);

    console.info("Testing statistics method...");
    const statisticsResult = await client.call("statistics", [bestBlockResult[0]]);
    console.info("statistics result:", statisticsResult);

    console.info("Testing serviceData method...");
    const serviceDataResult = await client.call("serviceData", [bestBlockResult[0], 0]);
    console.info("serviceData result:", serviceDataResult);

    console.info("Testing serviceValue method...");
    const serviceValueResult = await client.call("serviceValue", [
      bestBlockResult[0],
      1,
      [
        188, 243, 43, 129, 172, 117, 15, 152, 11, 3, 200, 203, 219, 175, 90, 215, 217, 230, 170, 216, 35, 208, 153, 226,
        9, 215, 213, 160, 184, 47, 42, 237,
      ],
    ]);
    console.info("serviceValue result:", serviceValueResult);

    console.info("Testing servicePreimage method...");
    const servicePreimageResult = await client.call("servicePreimage", [
      bestBlockResult[0],
      0,
      [
        193, 99, 38, 67, 43, 91, 50, 19, 223, 209, 96, 148, 149, 225, 60, 107, 39, 108, 180, 116, 214, 121, 100, 83, 55,
        229, 194, 192, 159, 25, 181, 60,
      ],
    ]);
    console.info("servicePreimage result:", servicePreimageResult);

    console.info("Testing serviceRequest method...");
    const serviceRequestResult = await client.call("serviceRequest", [
      bestBlockResult[0],
      0,
      [
        193, 99, 38, 67, 43, 91, 50, 19, 223, 209, 96, 148, 149, 225, 60, 107, 39, 108, 180, 116, 214, 121, 100, 83, 55,
        229, 194, 192, 159, 25, 181, 60,
      ],
      35,
    ]);
    console.info("serviceRequest result:", serviceRequestResult);

    console.info("Testing listServices method...");
    const listServicesResult = await client.call("listServices", [bestBlockResult[0]]);
    console.info("listServices result:", listServicesResult);

    console.info("Testing subscribeServicePreimage method...");
    const subscribeServicePreimageResult = await client.call("subscribeServicePreimage", [
      bestBlockResult[0],
      0,
      [
        193, 99, 38, 67, 43, 91, 50, 19, 223, 209, 96, 148, 149, 225, 60, 107, 39, 108, 180, 116, 214, 121, 100, 83, 55,
        229, 194, 192, 159, 25, 181, 60,
      ],
    ]);
    console.info("subscribeServicePreimage result:", subscribeServicePreimageResult);

    setTimeout(async () => {
      if (subscribeServicePreimageResult !== null) {
        console.info("Testing unsubscribeServicePreimage method...");
        const unsubscribeServicePreimageResult = await client.call("unsubscribeServicePreimage", [
          subscribeServicePreimageResult[0],
        ]);
        console.info("unsubscribeServicePreimage result:", unsubscribeServicePreimageResult);
      }

      client.close();
    }, 10000);
  } else {
    client.close();
  }
}

main();
