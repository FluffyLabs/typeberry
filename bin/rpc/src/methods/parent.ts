import type { HeaderHash } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import type { Hash, RpcMethod, Slot } from "../types";

/**
 * https://hackmd.io/@polkadot/jip2#parent
 * Returns the header hash and slot of the parent of the block with the given header hash, or `null` if
 * this is not known.
 * @param [
 *   Hash - The hash of a child's header.
 * ]
 * @returns Either null or [
 *   Hash - The parent's header hash,
 *   Slot - The slot,
 * ]
 */
export const parent: RpcMethod<[Hash], [Hash, Slot] | null> = async ([headerHash], db) => {
  const hashOpaque: HeaderHash = Bytes.fromNumbers(headerHash, HASH_SIZE).asOpaque();
  const header = db.blocks.getHeader(hashOpaque);
  if (header === null) {
    throw new Error(`${hashOpaque} not found.`);
  }

  const parentHash = header.parentHeaderHash.materialize();

  if (parentHash.isEqualTo(Bytes.zero(HASH_SIZE).asOpaque())) {
    return null;
  }

  const parentHeader = db.blocks.getHeader(parentHash);
  if (parentHeader === null) {
    throw new Error(`Parent (${parentHash}) not found.`);
  }

  return [Array.from(parentHash.raw), parentHeader.timeSlotIndex.materialize()];
};
