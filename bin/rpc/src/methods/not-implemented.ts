import z from "zod";
import { RpcError, RpcErrorCode, withValidation } from "../types.js";

export const notImplemented = withValidation(
  () => {
    throw new RpcError(RpcErrorCode.Other, "Method not implemented");
  },
  z.any(),
  z.any(),
);
