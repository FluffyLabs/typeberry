import { type HeaderHash, tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import type { BlobArray, Hash, RpcMethod, ServiceId } from "../types";

/**
 * https://hackmd.io/@polkadot/jip2#serviceValue
 * Returns the value associated with the given service ID and key in the posterior state of the block
 * with the given header hash. `null` is returned if there is no value associated with the given service
 * ID and key.
 * @param [
 *   Hash - The header hash indicating the block whose posterior state should be used for the query.
 *   ServiceId - The ID of the service.
 *   Blob - The key.
 * ]
 * @returns Either null or Blob
 */
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

  // TODO [ToDr] we should probably hash the blob to get `StateKey` instead.
  const storageValue = service.data.storage.get(Bytes.fromNumbers(key, HASH_SIZE).asOpaque());

  if (storageValue === undefined) {
    return null;
  }

  return [[...storageValue.blob.raw]];
};
