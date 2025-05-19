import { type HeaderHash, tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import type { BlobArray, Hash, RpcMethod, ServiceId } from "../types";

export const servicePreimage: RpcMethod<[Hash, ServiceId, Hash], [BlobArray] | null> = async (
  [headerHash, serviceId, preimageHash],
  db,
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

  const service = state.services.get(tryAsServiceId(serviceId));

  if (service === undefined) {
    return null;
  }

  const preimage = service.data.preimages.get(Bytes.fromNumbers(preimageHash, HASH_SIZE).asOpaque());

  if (preimage === undefined) {
    return null;
  }

  return [[...preimage.blob.raw]];
};
