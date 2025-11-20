import type { ChainSpec } from "@typeberry/config";
import type { BlocksDb, StatesDb } from "@typeberry/database";
import type { EnumerableState, State } from "@typeberry/state";
import type WebSocket from "ws";
import type { z } from "zod";
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
export type InputOf<Name extends MethodName> = z.infer<SchemaMap[Name]["input"]>;
export type OutputOf<Name extends MethodName> = z.infer<SchemaMap[Name]["output"]>;
export type Handler<Name extends MethodName> = (
  input: InputOf<Name>,
  db: DatabaseContext,
  chainSpec: ChainSpec,
) => Promise<OutputOf<Name>>;
export type HandlerMap = {
  [N in MethodName]: Handler<N>;
};

export type SubscribeMethodName =
  | "subscribeBestBlock"
  | "subscribeFinalizedBlock"
  | "subscribeServiceData"
  | "subscribeServicePreimage"
  | "subscribeServiceRequest"
  | "subscribeServiceValue"
  | "subscribeStatistics";
export type UnsubscribeMethodName =
  | "unsubscribeBestBlock"
  | "unsubscribeFinalizedBlock"
  | "unsubscribeServiceData"
  | "unsubscribeServicePreimage"
  | "unsubscribeServiceRequest"
  | "unsubscribeServiceValue"
  | "unsubscribeStatistics";

export type AnyMethodName = MethodName | SubscribeMethodName | UnsubscribeMethodName;

export type Subscription<M extends MethodName = MethodName> = {
  ws: WebSocket;
  method: M;
  params?: InputOf<M>;
};

export type SubscriptionId = string;
