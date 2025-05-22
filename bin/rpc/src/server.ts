import { existsSync } from "node:fs";
import type { ChainSpec } from "@typeberry/config";
import { LmdbBlocks, LmdbRoot, LmdbStates } from "@typeberry/database-lmdb";
import { WebSocketServer } from "ws";
import type { WebSocket } from "ws";
import { loadMethodsInto } from "./method-loader";
import { SUBSCRIBE_METHOD_MAP, SubscriptionManager, UNSUBSCRIBE_METHOD_WHITELIST } from "./subscription-manager";
import type {
  DatabaseContext,
  JsonRpcErrorResponse,
  JsonRpcId,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcResult,
  RpcMethodRepo,
} from "./types";
import { JSON_RPC_VERSION, RpcError } from "./types";

function createErrorResponse(error: RpcError, id: JsonRpcId): JsonRpcErrorResponse {
  return {
    jsonrpc: JSON_RPC_VERSION,
    error: {
      code: error.code,
      message: error.message,
    },
    id,
  };
}

export class RpcServer {
  private wss: WebSocketServer;
  private methods: RpcMethodRepo;
  private rootDb: LmdbRoot;
  private blocks: LmdbBlocks;
  private states: LmdbStates;
  private chainSpec: ChainSpec;
  private subscriptionManager: SubscriptionManager;

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

    loadMethodsInto(this.methods);
    this.setupWebSocket();
    this.subscriptionManager = new SubscriptionManager(this);
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

        if (request.jsonrpc !== JSON_RPC_VERSION) {
          ws.send(
            JSON.stringify(createErrorResponse(new RpcError(-32600, "Invalid JSON-RPC version"), request.id ?? null)),
          );
          return;
        }

        try {
          const result = await this.handleRequest(request, ws);
          if (request.id !== undefined) {
            const response: JsonRpcResponse = {
              jsonrpc: JSON_RPC_VERSION,
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

  private async handleRequest(request: JsonRpcRequest, ws: WebSocket): Promise<JsonRpcResult> {
    const { method, params } = request;

    if (SUBSCRIBE_METHOD_MAP.has(method)) {
      return [this.subscriptionManager.subscribe(ws, method, params)];
    }

    if (UNSUBSCRIBE_METHOD_WHITELIST.has(method)) {
      if (Array.isArray(params) && typeof params[0] === "string") {
        return [this.subscriptionManager.unsubscribe(params[0])];
      }

      throw new RpcError(-32602, "Invalid params");
    }

    if (params !== undefined && !Array.isArray(params)) {
      throw new RpcError(-32602, "Invalid params");
    }

    return this.callMethod(method, params);
  }

  async callMethod(method: string, params: unknown[] | undefined): Promise<JsonRpcResult> {
    if (!this.methods.has(method)) {
      throw new RpcError(-32601, `Method not found: ${method}`);
    }

    const db: DatabaseContext = {
      blocks: this.blocks,
      states: this.states,
    };

    return this.methods.get(method)?.(params, db, this.chainSpec);
  }

  async close(): Promise<void> {
    console.info("Cleaning up...");
    await new Promise<void>((resolve) => {
      this.wss.close(() => resolve());
    });
    this.subscriptionManager.destroy();
    await this.rootDb.db.close();
  }
}
