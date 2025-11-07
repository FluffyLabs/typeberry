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

export const withValidation = <P extends z.ZodType, R extends z.ZodType>(
  method: (params: z.infer<P>, db: DatabaseContext, chainSpec: ChainSpec) => Promise<z.infer<R>>,
  paramsSchema: P,
  resultSchema: R,
) => ({
  method,
  paramsSchema,
  resultSchema,
});
// biome-ignore lint/suspicious/noExplicitAny: any is used to make the method repo generic
export type RpcMethodRepo = Map<string, ReturnType<typeof withValidation<z.ZodType<any>, z.ZodType<any>>>>;

const zU32 = z.number().int().min(0).max(0xffffffff);
const zUint8Array = z.custom<Uint8Array>((v) => v instanceof Uint8Array); // this is needed because a simple z.instanceof(Uint8Array) automatically narrows the type down to Uint8Array<ArrayBuffer> whereas our Bytes.raw are effectively Uint8Array<ArrayBufferLike>

export const Hash = z.codec(
  z.base64(),
  zUint8Array.refine((v) => v.length === HASH_SIZE, "Invalid hash length."),
  {
    decode: (v) => Uint8Array.from(Buffer.from(v, "base64")),
    encode: (v) => Buffer.from(v).toString("base64"),
  },
);
export const Slot = zU32;
export const BlobArray = z.codec(z.base64(), zUint8Array, {
  decode: (v) => Uint8Array.from(Buffer.from(v, "base64")),
  encode: (v) => Buffer.from(v).toString("base64"),
});
export const ServiceId = zU32;
export const PreimageLength = zU32;
export const NoArgs = z.tuple([]);
export const BlockDescriptor = z.object({
  header_hash: Hash,
  slot: Slot,
});

export type Subscription = {
  ws: WebSocket;
  method: string;
  params?: unknown;
};

export type SubscriptionId = string;
