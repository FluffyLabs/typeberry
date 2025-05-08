import type { ChainSpec } from "@typeberry/config";
import type { RpcMethod } from "../types";

export const parameters: RpcMethod = async (_params, _db, chainSpec): Promise<[ChainSpec]> => {
  return [chainSpec];
};
