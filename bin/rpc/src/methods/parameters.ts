import type { Parameters, RpcMethod } from "../types";

export const parameters: RpcMethod<[], [Parameters]> = async (_params, _db, chainSpec) => {
  return [chainSpec];
};
