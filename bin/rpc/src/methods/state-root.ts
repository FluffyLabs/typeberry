import type { HeaderHash } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import type { Hash, RpcMethod } from "../types";

export const stateRoot: RpcMethod<[Hash], [Hash] | null> = async ([headerHash], db) => {
  const hashOpaque: HeaderHash = Bytes.fromNumbers(headerHash, HASH_SIZE).asOpaque();

  const stateRoot = db.blocks.getPostStateRoot(hashOpaque);

  if (stateRoot === null) {
    return null;
  }

  return [Array.from(stateRoot.raw)];
};
