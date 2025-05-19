import type { Hash, RpcMethod, Slot } from "../types";

export const bestBlock: RpcMethod<[], [Hash, Slot]> = async (_params, db) => {
  const [bestHash] = db.blocks.getBestData();

  const header = db.blocks.getHeader(bestHash);

  if (header === null) {
    throw new Error(`Best header not found with hash: ${bestHash.raw}`);
  }

  return [Array.from(bestHash.raw), header.timeSlotIndex.materialize()];
};
