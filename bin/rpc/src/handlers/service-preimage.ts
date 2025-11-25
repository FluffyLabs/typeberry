import { type HeaderHash, tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { type Handler, RpcError, RpcErrorCode } from "../types.js";

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
