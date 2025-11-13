import z from "zod";
import { RpcError, RpcErrorCode, withValidation } from "../types.js";

export const notImplemented = withValidation(z.any(), z.any(), () => {
  throw new RpcError(RpcErrorCode.Other, "Method not implemented");
});
