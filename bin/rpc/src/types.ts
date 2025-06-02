import type { ChainSpec } from "@typeberry/config";
import type { LmdbBlocks, LmdbStates } from "@typeberry/database-lmdb";
import type { U32 } from "@typeberry/numbers";
import type WebSocket from "ws";

export const JSON_RPC_VERSION = "2.0";
export type JSON_RPC_VERSION = typeof JSON_RPC_VERSION;

export type JsonRpcId = string | number | null;
export type JsonRpcResult = unknown[] | null;

export interface JsonRpcRequest {
  jsonrpc: JSON_RPC_VERSION;
  method: string;
  params?: unknown[];
  id: JsonRpcId;
}

export interface JsonRpcNotification extends Omit<JsonRpcRequest, "id"> {}

export interface JsonRpcSuccessResponse {
  jsonrpc: JSON_RPC_VERSION;
  result: JsonRpcResult;
  id: JsonRpcId;
}

export interface JsonRpcErrorResponse {
  jsonrpc: JSON_RPC_VERSION;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
  id: JsonRpcId;
}

export interface JsonRpcSubscriptionNotification extends JsonRpcNotification {
  params: [SubscriptionId, JsonRpcResult];
}

export type JsonRpcResponse = JsonRpcSuccessResponse | JsonRpcErrorResponse;

export class RpcError extends Error {
  constructor(
    public code: number,
    message: string,
  ) {
    super(message);
  }
}

export interface DatabaseContext {
  blocks: LmdbBlocks;
  states: LmdbStates;
}

export type RpcMethod<T extends unknown[], R extends JsonRpcResult> = (
  params: T,
  db: DatabaseContext,
  chainSpec: ChainSpec,
) => Promise<R>;

// biome-ignore lint/suspicious/noExplicitAny: the map must be able to store methods with any parameters and return values
export type RpcMethodRepo = Map<string, RpcMethod<any, any>>;

export type Subscription = {
  ws: WebSocket;
  method: string;
  params?: unknown[];
};

export type SubscriptionId = string;

export type Hash = number[];
export type Slot = U32;
export type BlobArray = number[];
export type ServiceId = U32;
export type None = [null];
