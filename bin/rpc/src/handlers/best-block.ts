import { type Handler, RpcError, RpcErrorCode } from "../types.js";
import { validation } from "../validation.js";

/**
 * https://hackmd.io/@polkadot/jip2#bestBlock
 * Returns the header hash and slot of the head of the "best" chain.
 * @returns [
 *   Hash - The header hash,
 *   Slot - The slot,
 * ]
 */
export const bestBlock: Handler<"bestBlock"> = async (_params, db) => {
  const headerHash = db.blocks.getBestHeaderHash();
  const header = db.blocks.getHeader(headerHash);

  if (header === null) {
    throw new RpcError(
      RpcErrorCode.BlockUnavailable,
      `Best header not found with hash: ${headerHash.toString()}`,
      validation.hash.encode(headerHash.raw),
    );
  }

  return {
    header_hash: headerHash.raw,
    slot: header.timeSlotIndex.materialize(),
  };
};
