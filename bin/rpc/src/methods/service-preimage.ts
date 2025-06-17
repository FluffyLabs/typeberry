import { type HeaderHash, tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import z from "zod";
import { type BlobArray, Hash, type RpcMethod, ServiceId } from "../types.js";

export const ServicePreimageParams = z.tuple([Hash, ServiceId, Hash]);
export type ServicePreimageParams = z.infer<typeof ServicePreimageParams>;

/**
 * https://hackmd.io/@polkadot/jip2#servicePreimage
 * Returns the preimage associated with the given service ID and hash in the posterior state of the
 * block with the given header hash. `null` is returned if there is no preimage associated with the
 * given service ID and hash.
 * @param [
 *   Hash - The header hash indicating the block whose posterior state should be used for the query.
 *   ServiceId - The ID of the service.
 *   Hash - The hash.
 * ]
 * @returns Either null or Blob
 */
export const servicePreimage: RpcMethod<ServicePreimageParams, [BlobArray] | null> = async (
  [headerHash, serviceId, preimageHash],
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

  const preimage = service.getPreimage(Bytes.fromNumbers(preimageHash, HASH_SIZE).asOpaque());

  if (preimage === null) {
    return null;
  }

  return [[...preimage.raw]];
};
