import type { RpcMethod } from "../types";

interface EchoParams {
  message: string;
}

export const echo: RpcMethod = async (params: unknown): Promise<unknown> => {
  const { message } = params as EchoParams;

  if (!message || typeof message !== "string") {
    throw new Error("Invalid parameters: message must be a string");
  }

  return { message };
};
