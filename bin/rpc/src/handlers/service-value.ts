import { type HeaderHash, tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { type Handler, RpcError, RpcErrorCode } from "@typeberry/rpc-validation";

/**
 * https://github.com/polkadot-fellows/JIPs/blob/772ce90bfc33f4e1de9de3bbe10c561753cc0d41/JIP-2.md#servicevalueheader_hash-id-key
 */
export const serviceValue: Handler<"serviceValue"> = async ([headerHash, serviceId, key], { db }) => {
  const hashOpaque: HeaderHash = Bytes.fromBlob(headerHash, HASH_SIZE).asOpaque();
  const state = db.states.getState(hashOpaque);

  if (state === null) {
    throw new RpcError(RpcErrorCode.Other, `State not found for block: ${hashOpaque.toString()}`);
  }

  const service = state.getService(tryAsServiceId(serviceId));

  if (service === null) {
    return null;
  }

  const storageValue = service.getStorage(Bytes.fromBlob(key, key.length).asOpaque());

  if (storageValue === null) {
    return null;
  }

  return storageValue.raw;
};
