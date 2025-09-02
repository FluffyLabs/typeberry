import { type HeaderHash, tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import z from "zod";
import { BlobArray, Hash, type RpcMethod, ServiceId } from "../types.js";

export const ServiceValueParams = z.tuple([Hash, ServiceId, BlobArray]);
export type ServiceValueParams = z.infer<typeof ServiceValueParams>;

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
export const serviceValue: RpcMethod<ServiceValueParams, [BlobArray] | null> = async (
  [headerHash, serviceId, key],
  db,
) => {
  const hashOpaque: HeaderHash = Bytes.fromNumbers(headerHash, HASH_SIZE).asOpaque();
  const state = db.states.getState(hashOpaque);

  if (state === null) {
    return null;
  }

  const service = state.getService(tryAsServiceId(serviceId));

  if (service === null) {
    return null;
  }

  const storageValue = service.getStorage(Bytes.fromNumbers(key, HASH_SIZE).asOpaque());

  if (storageValue === null) {
    return null;
  }

  return [[...storageValue.raw]];
};
