import type { LmdbBlocks, LmdbStates } from "@typeberry/database-lmdb";

export type JsonRpcId = string | number | null;

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
  id?: JsonRpcId;
}

export interface JsonRpcSuccessResponse {
  jsonrpc: "2.0";
  result: unknown;
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

export type RpcMethod = (params: unknown, db: DatabaseContext) => Promise<unknown>;
