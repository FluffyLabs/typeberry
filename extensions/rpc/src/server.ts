import { WebSocketServer } from "ws";
import type { WebSocket } from "ws";
import { loadMethods } from "./methodLoader";
import { MethodRegistry } from "./methodRegistry";
import type { JsonRpcRequest, JsonRpcResponse } from "./types";

export class RpcServer {
  private wss: WebSocketServer;
  private methodRegistry: MethodRegistry;

  constructor(port: number) {
    this.wss = new WebSocketServer({ port });
    this.methodRegistry = new MethodRegistry();
    loadMethods(this.methodRegistry);
    this.setupWebSocket();
  }

  private setupWebSocket(): void {
    this.wss.on("connection", (ws: WebSocket) => {
      ws.on("message", async (data: Buffer) => {
        try {
          const request: JsonRpcRequest = JSON.parse(data.toString());

          if (request.jsonrpc !== "2.0") {
            throw new Error("Invalid JSON-RPC version");
          }

          const response = await this.handleRequest(request);
          ws.send(JSON.stringify(response));
        } catch (error) {
          const errorResponse: JsonRpcResponse = {
            jsonrpc: "2.0",
            error: {
              code: -32603,
              message: error instanceof Error ? error.message : "Internal error",
            },
            id: null,
          };
          ws.send(JSON.stringify(errorResponse));
        }
      });
    });
  }

  private async handleRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    const { method, params, id } = request;

    const handler = this.methodRegistry.get(method);
    if (!handler) {
      return {
        jsonrpc: "2.0",
        error: {
          code: -32601,
          message: "Method not found",
        },
        id: id ?? null,
      };
    }

    try {
      const result = await handler(params);

      return {
        jsonrpc: "2.0",
        result,
        id: id ?? null,
      };
    } catch (error) {
      return {
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : "Internal error",
        },
        id: id ?? null,
      };
    }
  }
}
