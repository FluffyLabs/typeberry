import { existsSync } from "node:fs";
import type { ChainSpec } from "@typeberry/config";
import { LmdbBlocks, LmdbRoot, LmdbStates } from "@typeberry/database-lmdb";
import { Logger } from "@typeberry/logger";
import { WebSocketServer } from "ws";
import type { WebSocket } from "ws";
import z from "zod";
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

const UnsubscribeParams = z.tuple([z.string()]);

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

function createParamsParseErrorMessage(error: z.ZodError): string {
  return `Invalid params:\n${error.issues.map((issue) => `[${issue.path.join(".")}] ${issue.message}`).join(",\n")}`;
}

export class RpcServer {
  private readonly wss: WebSocketServer;
  private readonly rootDb: LmdbRoot;
  private readonly blocks: LmdbBlocks;
  private readonly states: LmdbStates;
  private readonly chainSpec: ChainSpec;
  private readonly subscriptionManager: SubscriptionManager;
  private readonly logger: Logger;

  constructor(
    port: number,
    dbPath: string,
    genesisRoot: string,
    chainSpec: ChainSpec,
    private readonly methods: RpcMethodRepo,
  ) {
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

  private validateCall(method: string, params: unknown): unknown {
    const methodEntry = this.methods.get(method);
    if (methodEntry === undefined) {
      throw new RpcError(-32601, `Method not found: ${method}`);
    }

    const [_, paramsSchema] = methodEntry;

    const parseResult = paramsSchema.safeParse(params);
    if (parseResult.error !== undefined) {
      throw new RpcError(-32602, createParamsParseErrorMessage(parseResult.error));
    }
    return parseResult.data;
  }

  private async handleRequest(request: JsonRpcRequest, ws: WebSocket): Promise<JsonRpcResult> {
    const { method, params } = request;

    const subscribeMethod = SUBSCRIBE_METHOD_MAP.get(method);
    if (subscribeMethod !== undefined) {
      const validatedParams = this.validateCall(subscribeMethod, params ?? null);
      return [this.subscriptionManager.subscribe(ws, subscribeMethod, validatedParams)];
    }

    if (UNSUBSCRIBE_METHOD_WHITELIST.has(method)) {
      const parseResult = UnsubscribeParams.safeParse(params);
      if (parseResult.error !== undefined) {
        throw new RpcError(-32602, createParamsParseErrorMessage(parseResult.error));
      }
      return [this.subscriptionManager.unsubscribe(parseResult.data[0])];
    }

    const validatedParams = this.validateCall(method, params ?? null);
    return this.callMethod(method, validatedParams);
  }

  getLogger(): Logger {
    return this.logger;
  }

  async callMethod(method: string, validatedParams: unknown): Promise<JsonRpcResult> {
    const methodEntry = this.methods.get(method);
    if (methodEntry === undefined) {
      throw new RpcError(-32601, `Method not found: ${method}`);
    }
    const [methodFn] = methodEntry;

    const db: DatabaseContext = {
      blocks: this.blocks,
      states: this.states,
    };

    return methodFn(validatedParams, db, this.chainSpec);
  }

  async close(): Promise<void> {
    this.logger.info("Cleaning up...");
    await new Promise<void>((resolve) => {
      for (const ws of this.wss.clients) {
        ws.terminate();
      }
      this.wss.close(() => resolve());
    });
    this.subscriptionManager.destroy();
    await this.rootDb.db.close();
  }
}
