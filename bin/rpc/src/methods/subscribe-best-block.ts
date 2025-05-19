import { RpcError, type RpcMethod } from "../types";

export const subscribeBestBlock: RpcMethod<[], []> = async () => {
  throw new RpcError(-32601, "Method not implemented");
};
