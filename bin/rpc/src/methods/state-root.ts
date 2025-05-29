import type { HeaderHash } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import type { Hash, RpcMethod } from "../types";

/**
 * https://hackmd.io/@polkadot/jip2#stateRoot
 * Returns the posterior state root of the block with the given header hash, or `null` if this is not
 * known.
 * @param [
 *   Hash - The header hash.
 * ]
 * @returns Either null or [
 *   Hash - state_root
 * ]
 */
export const stateRoot: RpcMethod<[Hash], [Hash] | null> = async ([headerHash], db) => {
  const hashOpaque: HeaderHash = Bytes.fromNumbers(headerHash, HASH_SIZE).asOpaque();

  const stateRoot = db.blocks.getPostStateRoot(hashOpaque);

  if (stateRoot === null) {
    return null;
  }

  return [Array.from(stateRoot.raw)];
};
