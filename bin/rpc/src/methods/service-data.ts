import { type HeaderHash, tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { Encoder } from "@typeberry/codec";
import { HASH_SIZE } from "@typeberry/hash";
import { ServiceAccountInfo } from "@typeberry/state";
import type { BlobArray, Hash, None, RpcMethod, ServiceId } from "../types";

export const serviceData: RpcMethod<[Hash, ServiceId], [BlobArray] | None | null> = async (
  [headerHash, serviceId],
  db,
  chainSpec,
) => {
  const hashOpaque: HeaderHash = Bytes.fromNumbers(headerHash, HASH_SIZE).asOpaque();
  const stateRoot = db.blocks.getPostStateRoot(hashOpaque);

  if (stateRoot === null) {
    return null;
  }

  const state = db.states.getFullState(stateRoot);

  if (state === null) {
    return null;
  }

  const serviceData = state.services.get(tryAsServiceId(serviceId));

  if (serviceData === undefined) {
    return [null];
  }

  return [Array.from(Encoder.encodeObject(ServiceAccountInfo.Codec, serviceData.data.info, chainSpec).raw)];
};
