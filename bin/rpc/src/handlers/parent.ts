import type { HeaderHash } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { type Handler, RpcError, RpcErrorCode } from "../types.js";
import { validation } from "../validation.js";

export const parent: Handler<"parent"> = async ([headerHash], { db }) => {
  const hashOpaque: HeaderHash = Bytes.fromBlob(headerHash, HASH_SIZE).asOpaque();
  const header = db.blocks.getHeader(hashOpaque);
  if (header === null) {
    throw new RpcError(
      RpcErrorCode.BlockUnavailable,
      `Block unavailable: ${hashOpaque.toString()}`,
      validation.hash.encode(hashOpaque.raw),
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
};
