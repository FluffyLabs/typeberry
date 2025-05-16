import type { ChainSpec } from "@typeberry/config";
import type { LmdbBlocks, LmdbStates } from "@typeberry/database-lmdb";
import type { U32 } from "@typeberry/numbers";

export type JsonRpcId = string | number | null;
export const JSON_RPC_VERSION = "2.0";

export interface JsonRpcRequest {
  jsonrpc: typeof JSON_RPC_VERSION;
  method: string;
  params?: unknown[];
  id?: JsonRpcId;
}

export interface JsonRpcSuccessResponse {
  jsonrpc: typeof JSON_RPC_VERSION;
  result: unknown[] | null;
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

export type RpcMethod<T extends unknown[], R extends unknown[] | null> = (
  params: T,
  db: DatabaseContext,
  chainSpec: ChainSpec,
) => Promise<R>;

export type Hash = number[];
export type Slot = U32;
export type BlobArray = number[];
export type ServiceId = U32;
export type None = [null];
