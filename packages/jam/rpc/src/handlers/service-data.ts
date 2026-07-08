import { type HeaderHash, tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { Encoder } from "@typeberry/codec";
import { HASH_SIZE } from "@typeberry/hash";
import { type Handler, RpcError, RpcErrorCode } from "@typeberry/rpc-validation";
import { ServiceAccountInfo } from "@typeberry/state";

/**
 * https://github.com/polkadot-fellows/JIPs/blob/772ce90bfc33f4e1de9de3bbe10c561753cc0d41/JIP-2.md#servicedataheader_hash-id
 */
export const serviceData: Handler<"serviceData"> = async ([headerHash, serviceId], { db, chainSpec }) => {
  const hashOpaque: HeaderHash = Bytes.fromBlob(headerHash, HASH_SIZE).asOpaque();
  const state = db.states.getState(hashOpaque);

  if (state === null) {
    throw new RpcError(RpcErrorCode.Other, `State not found for block: ${hashOpaque.toString()}`);
  }

  const serviceData = state.getService(tryAsServiceId(serviceId));

  if (serviceData === null) {
    return null;
  }

  return Encoder.encodeObject(ServiceAccountInfo.Codec, serviceData.getInfo(), chainSpec).raw;
};
