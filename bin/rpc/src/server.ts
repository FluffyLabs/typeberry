import type { ChainSpec } from "@typeberry/config";
import { LmdbBlocks, type LmdbRoot, LmdbStates } from "@typeberry/database-lmdb";
import { Logger } from "@typeberry/logger";
import { WebSocketServer } from "ws";
import type { WebSocket } from "ws";
import z from "zod";
import { SUBSCRIBE_METHOD_MAP, SubscriptionManager } from "./subscription-manager.js";
import {
  type DatabaseContext,
  type JsonRpcErrorResponse,
  type JsonRpcId,
  JsonRpcNotification,
  JsonRpcRequest,
  type JsonRpcResponse,
  type JsonRpcResult,
  type RpcMethodRepo,
} from "./types.js";
import { JSON_RPC_VERSION, RpcError } from "./types.js";

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
  private readonly blocks: LmdbBlocks;
  private readonly states: LmdbStates;
  private readonly subscriptionManager: SubscriptionManager;
  private readonly logger: Logger;

  constructor(
    port: number,
    private readonly rootDb: LmdbRoot,
    private readonly chainSpec: ChainSpec,
    private readonly methods: RpcMethodRepo,
  ) {
    this.logger = Logger.new(import.meta.filename, "rpc");

    this.blocks = new LmdbBlocks(chainSpec, this.rootDb);
    this.states = new LmdbStates(chainSpec, this.rootDb);

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

      ws.on("message", async (data: string) => {
        let rawRequest: unknown;
        try {
          rawRequest = JSON.parse(data);
        } catch {
          ws.send(JSON.stringify(createErrorResponse(new RpcError(-32700, "Parse error"), null)));
          return;
        }

        if (Array.isArray(rawRequest)) {
          if (rawRequest.length === 0) {
            ws.send(JSON.stringify(createErrorResponse(new RpcError(-32600, "Array must contain requests."), null)));
            return;
          }

          const responses = (
            await Promise.all(rawRequest.map((request: unknown) => this.handleRequest(request, ws)))
          ).filter((response) => response !== null);

          if (responses.length > 0) {
            ws.send(JSON.stringify(responses));
          }

          return;
        }

        const response = await this.handleRequest(rawRequest, ws);
        if (response !== null) {
          ws.send(JSON.stringify(response));
        }
      });
    });
  }

  private async handleRequest(request: unknown, ws: WebSocket): Promise<JsonRpcResponse | null> {
    const requestParseResult = JsonRpcRequest.safeParse(request);
    if (requestParseResult.success === true) {
      try {
        return {
          jsonrpc: JSON_RPC_VERSION,
          result: await this.fulfillRequest(requestParseResult.data, ws),
          id: requestParseResult.data.id,
        };
      } catch (error) {
        const rpcError =
          error instanceof RpcError
            ? error
            : new RpcError(-32603, error instanceof Error ? error.message : "Internal error");
        return createErrorResponse(rpcError, requestParseResult.data.id);
      }
    }

    const notificationParseResult = JsonRpcNotification.safeParse(request);
    if (notificationParseResult.success === true) {
      try {
        await this.fulfillRequest(notificationParseResult.data, ws);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        this.logger.error(`Notification ${JSON.stringify(notificationParseResult.data)} caused an error: ${msg}`);
      }

      return null;
    }

    return createErrorResponse(new RpcError(-32600, `Invalid request: ${JSON.stringify(request)}`), null);
  }

  private async fulfillRequest(request: JsonRpcRequest | JsonRpcNotification, ws: WebSocket): Promise<JsonRpcResult> {
    const { method, params } = request;

    const [subscribeMethod, _] = SUBSCRIBE_METHOD_MAP.get(method) ?? [];
    if (subscribeMethod !== undefined) {
      const validatedParams = this.validateCall(subscribeMethod, params ?? null);
      return [this.subscriptionManager.subscribe(ws, subscribeMethod, validatedParams)];
    }

    if ([...SUBSCRIBE_METHOD_MAP.values()].some(([, unsubscribeMethod]) => unsubscribeMethod === method)) {
      const parseResult = UnsubscribeParams.safeParse(params);
      if (parseResult.error !== undefined) {
        throw new RpcError(-32602, createParamsParseErrorMessage(parseResult.error));
      }
      return [this.subscriptionManager.unsubscribe(parseResult.data[0])];
    }

    const validatedParams = this.validateCall(method, params ?? null);
    return this.callMethod(method, validatedParams);
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

  getLogger(): Logger {
    return this.logger;
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
