import { type HeaderHash, tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import z from "zod";
import { Hash, PreimageLength, type RpcMethod, ServiceId, type Slot } from "../types";

export const ServiceRequestParams = z.tuple([Hash, ServiceId, Hash, PreimageLength]);
export type ServiceRequestParams = z.infer<typeof ServiceRequestParams>;

/**
 * https://hackmd.io/@polkadot/jip2#serviceRequest
 * Returns the preimage request associated with the given service ID and hash/len in the posterior state
 * of the block with the given header hash. `null` is returned if there is no preimage request
 * associated with the given service ID, hash and length.
 * @param [
 *   Hash - The header hash indicating the block whose posterior state should be used for the query.
 *   ServiceId - The ID of the service.
 *   Hash - The hash.
 *   U32 - The preimage length.
 * ]
 * @returns Either null or array of Slot
 */
export const serviceRequest: RpcMethod<ServiceRequestParams, [Slot[]] | null> = async (
  [headerHash, serviceId, preimageHash, preimageLength],
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

  const preimage = service.data.lookupHistory
    .get(Bytes.fromNumbers(preimageHash, HASH_SIZE).asOpaque())
    ?.find(({ length }) => length === preimageLength);

  if (preimage === undefined) {
    return null;
  }

  return [preimage.slots];
};
