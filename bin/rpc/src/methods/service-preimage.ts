import { type HeaderHash, tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import z from "zod";
import { type BlobArray, Hash, type RpcMethod, ServiceId } from "../types";

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
