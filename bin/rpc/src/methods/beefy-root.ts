import { RpcError, type RpcMethod } from "../types";

export const beefyRoot: RpcMethod<[], []> = async () => {
  throw new RpcError(-32601, "Method not implemented");
};
