import { type HeaderHash, tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { type Handler, RpcError, RpcErrorCode } from "@typeberry/rpc-validation";

/**
 * https://github.com/polkadot-fellows/JIPs/blob/772ce90bfc33f4e1de9de3bbe10c561753cc0d41/JIP-2.md#servicepreimageheader_hash-id-hash
 */
export const servicePreimage: Handler<"servicePreimage"> = async ([headerHash, serviceId, preimageHash], { db }) => {
  const hashOpaque: HeaderHash = Bytes.fromBlob(headerHash, HASH_SIZE).asOpaque();
  const state = db.states.getState(hashOpaque);

  if (state === null) {
    throw new RpcError(RpcErrorCode.Other, `State not found for block: ${hashOpaque.toString()}`);
  }

  const service = state.getService(tryAsServiceId(serviceId));

  if (service === null) {
    throw new RpcError(RpcErrorCode.Other, `Service not found: ${serviceId.toString()}`);
  }

  const preimage = service.getPreimage(Bytes.fromBlob(preimageHash, HASH_SIZE).asOpaque());

  if (preimage === null) {
    return null;
  }

  return preimage.raw;
};
