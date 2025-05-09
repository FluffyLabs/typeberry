import { existsSync } from "node:fs";
import type { ChainSpec } from "@typeberry/config";
import { LmdbBlocks, LmdbRoot, LmdbStates } from "@typeberry/database-lmdb";
import { WebSocketServer } from "ws";
import type { WebSocket } from "ws";
import { loadMethods } from "./methodLoader";
import type { DatabaseContext, JsonRpcRequest, JsonRpcResponse, RpcMethod } from "./types";

export class RpcServer {
  private wss: WebSocketServer;
  // biome-ignore lint/suspicious/noExplicitAny: the map must be able to store methods with any parameters and return values
  private methods: Map<string, RpcMethod<any, any>>;
  private rootDb: LmdbRoot;
  private blocks: LmdbBlocks;
  private states: LmdbStates;
  private chainSpec: ChainSpec;

  constructor(port: number, dbPath: string, genesisRoot: string, chainSpec: ChainSpec) {
    this.wss = new WebSocketServer({ port });
    this.methods = new Map();
    this.chainSpec = chainSpec;

    const fullDbPath = `${dbPath}/${genesisRoot}`;
    if (!existsSync(fullDbPath)) {
      throw new Error(`Database not found at ${fullDbPath}`);
    }
    this.rootDb = new LmdbRoot(fullDbPath);
    this.blocks = new LmdbBlocks(chainSpec, this.rootDb);
    this.states = new LmdbStates(chainSpec, this.rootDb);

    loadMethods(this.methods);
    this.setupWebSocket();
    console.info(`Server listening on port ${port}...`);
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

    const handler = this.methods.get(method);
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
      const db: DatabaseContext = {
        blocks: this.blocks,
        states: this.states,
      };
      const result = await handler(params ?? [], db, this.chainSpec);

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

  async close(): Promise<void> {
    console.info("Closing websocket and db connections...");
    await new Promise<void>((resolve) => {
      this.wss.close(() => resolve());
    });
    await this.rootDb.db.close();
  }
}
