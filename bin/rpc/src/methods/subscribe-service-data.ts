import { RpcError, type RpcMethod } from "../types";

export const subscribeServiceData: RpcMethod<[], []> = async () => {
  throw new RpcError(-32601, "Method not implemented");
};
