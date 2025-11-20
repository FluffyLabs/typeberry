import type { HeaderHash } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { type Handler, RpcError, RpcErrorCode } from "../types.js";

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
export const stateRoot: Handler<"stateRoot"> = async ([headerHash], db) => {
  const hashOpaque: HeaderHash = Bytes.fromBlob(headerHash, HASH_SIZE).asOpaque();

  const stateRoot = db.blocks.getPostStateRoot(hashOpaque);

  if (stateRoot === null) {
    throw new RpcError(RpcErrorCode.BlockUnavailable, `Block unavailable: ${hashOpaque.toString()}`, hashOpaque.raw);
  }

  return stateRoot.raw;
};
