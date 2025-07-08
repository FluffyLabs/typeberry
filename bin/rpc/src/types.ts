import type { ChainSpec } from "@typeberry/config";
import type { BlocksDb, StatesDb } from "@typeberry/database";
import { HASH_SIZE } from "@typeberry/hash";
import type { EnumerableState, State } from "@typeberry/state";
import type WebSocket from "ws";
import { z } from "zod";

export const JSON_RPC_VERSION = "2.0";
export type JSON_RPC_VERSION = typeof JSON_RPC_VERSION;

export type JsonRpcResult = unknown;

export const JsonRpcRequest = z.object({
  jsonrpc: z.literal(JSON_RPC_VERSION),
  method: z.string(),
  params: z.unknown().optional(),
  id: z.union([z.string(), z.number(), z.null()]),
});
export type JsonRpcRequest = z.infer<typeof JsonRpcRequest>;

export const JsonRpcNotification = JsonRpcRequest.omit({ id: true });
export type JsonRpcNotification = z.infer<typeof JsonRpcNotification>;

export type JsonRpcId = JsonRpcRequest["id"];

export interface JsonRpcSuccessResponse {
  jsonrpc: JSON_RPC_VERSION;
  result: unknown;
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
  ) {
    super(message);
  }
}

export interface DatabaseContext {
  blocks: BlocksDb;
  states: StatesDb<State & EnumerableState>;
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
export const NoArgs = z.union([z.null(), z.array(z.any()).length(0)]);

export type Hash = z.infer<typeof Hash>;
export type Slot = z.infer<typeof Slot>;
export type BlobArray = z.infer<typeof BlobArray>;
export type ServiceId = z.infer<typeof ServiceId>;
export type PreimageLength = z.infer<typeof PreimageLength>;
export type NoArgs = z.infer<typeof NoArgs>;

export type None = [null];
