import type { ChainSpec } from "@typeberry/config";
import type { BlocksDb, StatesDb } from "@typeberry/database";
import type { EnumerableState, State } from "@typeberry/state";
import type WebSocket from "ws";
import type { z } from "zod";
import type { SUBSCRIBABLE_METHODS } from "./subscription-manager.js";
import type { JSON_RPC_VERSION, validation } from "./validation.js";

export type JsonRpcResult = unknown;

export type JsonRpcRequest = z.infer<typeof validation.jsonRpcRequest>;

export type JsonRpcNotification = z.infer<typeof validation.jsonRpcNotification>;

export type JsonRpcId = JsonRpcRequest["id"];

export interface JsonRpcSuccessResponse {
  jsonrpc: typeof JSON_RPC_VERSION;
  result: unknown;
  id: JsonRpcId;
}

export interface JsonRpcErrorResponse {
  jsonrpc: typeof JSON_RPC_VERSION;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
  id: JsonRpcId;
}

interface JsonRpcSubscriptionResultNotification extends JsonRpcNotification {
  params: {
    subscriptionId: SubscriptionId;
    result: JsonRpcResult;
  };
}

interface JsonRpcSubscriptionErrorNotification extends JsonRpcNotification {
  params: {
    subscriptionId: SubscriptionId;
    error: unknown;
  };
}

export type JsonRpcSubscriptionNotification =
  | JsonRpcSubscriptionResultNotification
  | JsonRpcSubscriptionErrorNotification;

export type JsonRpcResponse = JsonRpcSuccessResponse | JsonRpcErrorResponse;

export class RpcError extends Error {
  constructor(
    public code: number,
    message: string,
    public data?: unknown,
  ) {
    super(message);
  }
}

export enum RpcErrorCode {
  BlockUnavailable = 1,
  WorkReportUnavailable = 2,
  DASegmentUnavailable = 3,
  Other = 0,
}

export interface DatabaseContext {
  blocks: BlocksDb;
  states: StatesDb<State & EnumerableState>;
}

export type SchemaMap = typeof validation.schemas;
export type MethodName = keyof SchemaMap;
export type MethodWithNoArgsName = keyof {
  [K in keyof SchemaMap as SchemaMap[K]["input"] extends z.ZodTuple<[]> ? K : never]: SchemaMap[K];
};
export type SchemaMapUnknown = Record<MethodName, { input: z.ZodTypeAny; output: z.ZodTypeAny }>;
export type InputOf<M extends MethodName> = z.infer<SchemaMap[M]["input"]>;
export type OutputOf<M extends MethodName> = z.infer<SchemaMap[M]["output"]>;
export type GenericHandler<I, O> = (
  input: I,
  context: { db: DatabaseContext; chainSpec: ChainSpec; subscription: SubscriptionHandlerApi },
) => Promise<O>;
export type Handler<M extends MethodName> = GenericHandler<InputOf<M>, OutputOf<M>>;
export type HandlerMap = {
  [N in MethodName]: Handler<N>;
};

export type Subscription<M extends MethodName = MethodName> = {
  ws: WebSocket;
  method: M;
  params: InputOf<M>;
};

export type SubscriptionId = string;

export type SubscriptionHandlerApi = {
  subscribe: <M extends MethodName>(method: M, params: InputOf<M>) => SubscriptionId;
  unsubscribe: (id: SubscriptionId) => boolean;
};

export type SubscribableMethodName = keyof typeof SUBSCRIBABLE_METHODS;
