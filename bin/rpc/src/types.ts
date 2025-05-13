import type { ChainSpec } from "@typeberry/config";
import type { LmdbBlocks, LmdbStates } from "@typeberry/database-lmdb";
import type { U32 } from "@typeberry/numbers";

export type JsonRpcId = string | number | null;

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  method: string;
  params?: unknown[];
  id?: JsonRpcId;
}

export interface JsonRpcSuccessResponse {
  jsonrpc: "2.0";
  result: unknown[] | null;
  id: JsonRpcId;
}

export interface JsonRpcErrorResponse {
  jsonrpc: "2.0";
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
  id: JsonRpcId;
}

export type JsonRpcResponse = JsonRpcSuccessResponse | JsonRpcErrorResponse;

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
export type Parameters = ChainSpec;
