import z from "zod";
import type { Hash, RpcMethod, Slot } from "../types";

export const BestBlockParams = z.null();
export type BestBlockParams = z.infer<typeof BestBlockParams>;

/**
 * https://hackmd.io/@polkadot/jip2#bestBlock
 * Returns the header hash and slot of the head of the "best" chain.
 * @returns [
 *   Hash - The header hash,
 *   Slot - The slot,
 * ]
 */
export const bestBlock: RpcMethod<BestBlockParams, [Hash, Slot]> = async (_params, db) => {
  const [headerHash] = db.blocks.getBestData();

  const header = db.blocks.getHeader(headerHash);

  if (header === null) {
    throw new Error(`Best header not found with hash: ${headerHash.raw}`);
  }

  return [Array.from(headerHash.raw), header.timeSlotIndex.materialize()];
};
