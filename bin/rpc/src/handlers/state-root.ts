import type { HeaderHash } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { type Handler, RpcError, RpcErrorCode } from "../types.js";

/**
 * https://github.com/polkadot-fellows/JIPs/blob/772ce90bfc33f4e1de9de3bbe10c561753cc0d41/JIP-2.md#staterootheader_hash
 */
export const stateRoot: Handler<"stateRoot"> = async ([headerHash], { db }) => {
  const hashOpaque: HeaderHash = Bytes.fromBlob(headerHash, HASH_SIZE).asOpaque();

  const stateRoot = db.blocks.getPostStateRoot(hashOpaque);

  if (stateRoot === null) {
    throw new RpcError(RpcErrorCode.BlockUnavailable, `Block unavailable: ${hashOpaque.toString()}`, hashOpaque.raw);
  }

  return stateRoot.raw;
};
