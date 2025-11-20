import { RpcError, RpcErrorCode } from "../types.js";

export const notImplemented = () => {
  throw new RpcError(RpcErrorCode.Other, "Method not implemented");
};
