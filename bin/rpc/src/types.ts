import type { ChainSpec } from "@typeberry/config";
import type { LmdbBlocks, LmdbStates } from "@typeberry/database-lmdb";
import { HASH_SIZE } from "@typeberry/hash";
import type WebSocket from "ws";
import { z } from "zod";

export const JSON_RPC_VERSION = "2.0";
export type JSON_RPC_VERSION = typeof JSON_RPC_VERSION;

export type JsonRpcId = string | number | null;
export type JsonRpcResult = unknown[] | null;

export interface JsonRpcRequest {
  jsonrpc: JSON_RPC_VERSION;
  method: string;
  params?: unknown;
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

export type RpcMethod<T, R> = (params: T, db: DatabaseContext, chainSpec: ChainSpec) => Promise<R>;
// biome-ignore lint/suspicious/noExplicitAny: any is used to make the method repo generic
export type RpcMethodRepo = Map<string, [RpcMethod<any, any>, z.ZodType<any>]>;

export type Subscription = {
  ws: WebSocket;
  method: string;
  params?: unknown;
};

export type SubscriptionId = string;

const ZU32 = z.number().int().min(0).max(0xffffffff);

export const Hash = z.array(z.number()).length(HASH_SIZE);
export const Slot = ZU32;
export const BlobArray = z.array(z.number().int().min(0).max(255));
export const ServiceId = ZU32;
export const PreimageLength = ZU32;

export type Hash = z.infer<typeof Hash>;
export type Slot = z.infer<typeof Slot>;
export type BlobArray = z.infer<typeof BlobArray>;
export type ServiceId = z.infer<typeof ServiceId>;
export type PreimageLength = z.infer<typeof PreimageLength>;

export type None = [null];
