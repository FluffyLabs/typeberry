import type { RpcMethod } from "../types.js";

export const finalizedBlock: RpcMethod<[], []> = async (): Promise<[]> => {
  // todo [seko] implement when finality is implemented
  return [];
};
