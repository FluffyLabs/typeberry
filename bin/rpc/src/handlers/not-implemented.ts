import { type GenericHandler, RpcError, RpcErrorCode, type validation } from "@typeberry/rpc-validation";
import type z from "zod";

export const notImplemented: GenericHandler<
  z.infer<typeof validation.notImplementedSchema.input>,
  z.infer<typeof validation.notImplementedSchema.output>
> = () => {
  throw new RpcError(RpcErrorCode.Other, "Method not implemented");
};
