import { type Handler, RpcError, RpcErrorCode, validation } from "@typeberry/rpc-validation";

/**
 * https://github.com/polkadot-fellows/JIPs/blob/772ce90bfc33f4e1de9de3bbe10c561753cc0d41/JIP-2.md#bestblock
 */
export const bestBlock: Handler<"bestBlock"> = async (_params, { db }) => {
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
