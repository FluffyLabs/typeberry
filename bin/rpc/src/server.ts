import { existsSync } from "node:fs";
import type { ChainSpec } from "@typeberry/config";
import { LmdbBlocks, LmdbRoot, LmdbStates } from "@typeberry/database-lmdb";
import { WebSocketServer } from "ws";
import type { WebSocket } from "ws";
import { loadMethods } from "./methodLoader";
import type {
  DatabaseContext,
  JsonRpcErrorResponse,
  JsonRpcId,
  JsonRpcRequest,
  JsonRpcResponse,
  RpcMethod,
} from "./types";
import { RpcError } from "./types";

function createErrorResponse(error: RpcError, id: JsonRpcId): JsonRpcErrorResponse {
  return {
    jsonrpc: "2.0",
    error: {
      code: error.code,
      message: error.message,
    },
    id,
  };
}

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

    const fullDbPath = `${dbPath}/${genesisRoot}`;
    if (!existsSync(fullDbPath)) {
      throw new Error(`Database not found at ${fullDbPath}`);
    }
    this.rootDb = new LmdbRoot(fullDbPath, true);
    this.blocks = new LmdbBlocks(chainSpec, this.rootDb);
    this.states = new LmdbStates(chainSpec, this.rootDb);
    this.chainSpec = chainSpec;

    loadMethods(this.methods);
    this.setupWebSocket();
    console.info(`Server listening on port ${port}...`);
  }

  private setupWebSocket(): void {
    this.wss.on("connection", (ws: WebSocket) => {
      ws.on("message", async (data: Buffer) => {
        let request: JsonRpcRequest;
        try {
          request = JSON.parse(data.toString());
        } catch {
          ws.send(JSON.stringify(createErrorResponse(new RpcError(-32700, "Parse error"), null)));
          return;
        }

        if (request.jsonrpc !== "2.0") {
          ws.send(
            JSON.stringify(createErrorResponse(new RpcError(-32600, "Invalid JSON-RPC version"), request.id ?? null)),
          );
          return;
        }

        try {
          const result = await this.handleRequest(request);
          if (request.id !== undefined) {
            const response: JsonRpcResponse = {
              jsonrpc: "2.0",
              result,
              id: request.id,
            };
            ws.send(JSON.stringify(response));
          }
        } catch (error) {
          if (request.id !== undefined) {
            const rpcError =
              error instanceof RpcError
                ? error
                : new RpcError(-32603, error instanceof Error ? error.message : "Internal error");
            ws.send(JSON.stringify(createErrorResponse(rpcError, request.id)));
          }
        }
      });
    });
  }

  private async handleRequest(request: JsonRpcRequest): Promise<unknown[] | null> {
    const { method, params } = request;

    const handler = this.methods.get(method);
    if (handler === undefined) {
      throw new RpcError(-32601, "Method not found");
    }

    if (params !== undefined && !Array.isArray(params)) {
      throw new RpcError(-32602, "Invalid params");
    }

    const db: DatabaseContext = {
      blocks: this.blocks,
      states: this.states,
    };

    return handler(params, db, this.chainSpec);
  }

  async close(): Promise<void> {
    console.info("Closing websocket and db connections...");
    await new Promise<void>((resolve) => {
      this.wss.close(() => resolve());
    });
    await this.rootDb.db.close();
  }
}
