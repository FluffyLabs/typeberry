import type { HeaderHash } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU32 } from "@typeberry/numbers";
import type { Hash, RpcMethod, Slot } from "../types";

export const parent: RpcMethod<[Hash], [Hash, Slot]> = async ([headerHash], db) => {
  const hash: HeaderHash = Bytes.fromNumbers(headerHash, HASH_SIZE).asOpaque();
  const header = db.blocks.getHeader(hash);
  if (header === null) {
    throw new Error(`${hash} not found.`);
  }

  const parentHash = header.parentHeaderHash.materialize();

  if (parentHash.isEqualTo(Bytes.zero(HASH_SIZE).asOpaque())) {
    return [Array.from(parentHash.raw), tryAsU32(0)];
  }

  const parentHeader = db.blocks.getHeader(parentHash);
  if (parentHeader === null) {
    throw new Error(`Parent (${parentHash}) not found.`);
  }

  return [Array.from(parentHash.raw), parentHeader.timeSlotIndex.materialize()];
};
