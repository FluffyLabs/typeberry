import { type HeaderHash, tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import type { BlobArray, Hash, RpcMethod, ServiceId } from "../types";

export const serviceValue: RpcMethod<[Hash, ServiceId, BlobArray], [BlobArray] | null> = async (
  [headerHash, serviceId, key],
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

  const storageValue = service.data.storage.find(({ hash }) => hash.isEqualTo(Bytes.fromNumbers(key, HASH_SIZE)));

  if (storageValue === undefined) {
    return null;
  }

  return [[...storageValue.blob.raw]];
};
