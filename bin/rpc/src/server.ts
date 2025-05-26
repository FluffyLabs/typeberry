import { existsSync } from "node:fs";
import type { ChainSpec } from "@typeberry/config";
import { LmdbBlocks, LmdbRoot, LmdbStates } from "@typeberry/database-lmdb";
import { Logger } from "@typeberry/logger";
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

const PING_INTERVAL_MS = 30000;

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
  private readonly wss: WebSocketServer;
  private readonly methods: RpcMethodRepo;
  private readonly rootDb: LmdbRoot;
  private readonly blocks: LmdbBlocks;
  private readonly states: LmdbStates;
  private readonly chainSpec: ChainSpec;
  private readonly subscriptionManager: SubscriptionManager;
  private readonly logger: Logger;

  constructor(port: number, dbPath: string, genesisRoot: string, chainSpec: ChainSpec) {
    this.logger = Logger.new(__filename, "rpc");

    const fullDbPath = `${dbPath}/${genesisRoot}`;
    if (!existsSync(fullDbPath)) {
      this.logger.error(`Database not found at ${fullDbPath}`);
      process.exit(1);
    }
    this.rootDb = new LmdbRoot(fullDbPath, true);
    this.blocks = new LmdbBlocks(chainSpec, this.rootDb);
    this.states = new LmdbStates(chainSpec, this.rootDb);

    this.chainSpec = chainSpec;

    this.methods = new Map();
    loadMethodsInto(this.methods);

    this.wss = new WebSocketServer({ port });
    this.setupWebSocket();

    this.subscriptionManager = new SubscriptionManager(this);
  }

  private setupWebSocket(): void {
    this.wss.on("error", (error) => {
      this.logger.error(`Server error: ${error}`);
    });

    this.wss.on("listening", () => {
      this.logger.info(`Server listening on port ${this.wss.options.port}`);
    });

    this.wss.on("connection", (ws: WebSocket) => {
      let isAlive = true;

      ws.on("pong", () => {
        isAlive = true;
      });

      const pingInterval = setInterval(() => {
        if (!isAlive) {
          ws.terminate();
        }
        isAlive = false;
        ws.ping();
        this.logger.info("Pinging client");
      }, PING_INTERVAL_MS);

      ws.on("close", () => {
        clearInterval(pingInterval);
      });

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

  getLogger(): Logger {
    return this.logger;
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
    this.logger.info("Cleaning up...");
    await new Promise<void>((resolve) => {
      for (const ws of this.wss.clients) {
        ws.close();
      }
      this.wss.close(() => resolve());
    });
    this.subscriptionManager.destroy();
    await this.rootDb.db.close();
  }
}
