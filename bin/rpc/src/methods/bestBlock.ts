import type { Hash, RpcMethod, Slot } from "../types";

export const bestBlock: RpcMethod<[], [Hash, Slot]> = async (_params, db) => {
  const [headerHash] = db.blocks.getBestData();

  const header = db.blocks.getHeader(headerHash);
  if (!header) {
    throw new Error(`Best header not found with hash: ${headerHash.raw}`);
  }

  return [Array.from(headerHash.raw), header.timeSlotIndex.materialize()];
};
