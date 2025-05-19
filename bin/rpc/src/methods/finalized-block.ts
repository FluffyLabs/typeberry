import { RpcError, type RpcMethod } from "../types";

export const finalizedBlock: RpcMethod<[], []> = async () => {
  // todo [seko] implement when finality is implemented
  throw new RpcError(-32601, "Method not implemented");
};
