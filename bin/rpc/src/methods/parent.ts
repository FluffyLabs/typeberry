import type { HeaderHash } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import z from "zod";
import { BlockDescriptor, Hash, RpcError, RpcErrorCode, withValidation } from "../types.js";

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
export const parent = withValidation(
  async ([headerHash], db) => {
    const hashOpaque: HeaderHash = Bytes.fromBlob(headerHash, HASH_SIZE).asOpaque();
    const header = db.blocks.getHeader(hashOpaque);
    if (header === null) {
      throw new RpcError(
        RpcErrorCode.BlockUnavailable,
        `Block unavailable: ${hashOpaque.toString()}`,
        Hash.encode(hashOpaque.raw),
      );
    }

    const parentHash = header.parentHeaderHash.materialize();

    if (parentHash.isEqualTo(Bytes.zero(HASH_SIZE).asOpaque())) {
      throw new RpcError(RpcErrorCode.Other, `Parent not found for block: ${hashOpaque.toString()}`);
    }

    const parentHeader = db.blocks.getHeader(parentHash);
    if (parentHeader === null) {
      throw new RpcError(
        RpcErrorCode.Other,
        `The hash of parent was found (${parentHash}) but its header doesn't exist in the database.`,
      );
    }

    return {
      header_hash: parentHash.raw,
      slot: parentHeader.timeSlotIndex.materialize(),
    };
  },
  z.tuple([Hash]),
  BlockDescriptor,
);
