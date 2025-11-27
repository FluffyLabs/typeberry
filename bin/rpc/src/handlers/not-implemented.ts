import type z from "zod";
import { type GenericHandler, RpcError, RpcErrorCode } from "../types.js";
import type { validation } from "../validation.js";

export const notImplemented: GenericHandler<
  z.infer<typeof validation.notImplementedSchema.input>,
  z.infer<typeof validation.notImplementedSchema.output>
> = () => {
  throw new RpcError(RpcErrorCode.Other, "Method not implemented");
};
