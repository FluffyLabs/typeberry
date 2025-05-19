import type { Hash, RpcMethod, Slot } from "../types.js";

export const bestBlock: RpcMethod<[], [Hash, Slot]> = async (_params, db) => {
  const [headerHash] = db.blocks.getBestData();

  const header = db.blocks.getHeader(headerHash);

  if (header === null) {
    throw new Error(`Best header not found with hash: ${headerHash.raw}`);
  }

  return [Array.from(headerHash.raw), header.timeSlotIndex.materialize()];
};
