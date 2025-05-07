import type { DatabaseContext, RpcMethod } from "../types";

export const bestBlock: RpcMethod = async (_params, db: DatabaseContext): Promise<[Uint8Array]> => {
  const [headerHash] = db.blocks.getBestData();
  return [headerHash.raw];
};
