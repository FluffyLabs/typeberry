import { type HeaderHash, tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import z from "zod";
import { Hash, PreimageLength, type RpcMethod, ServiceId, type Slot } from "../types";
import {tryAsU32} from "@typeberry/numbers";

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
export const serviceRequest: RpcMethod<ServiceRequestParams, [readonly Slot[]] | null> = async (
  [headerHash, serviceId, preimageHash, preimageLength],
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

  const slots = service.getLookupHistory(
    Bytes.fromNumbers(preimageHash, HASH_SIZE).asOpaque(),
    tryAsU32(preimageLength),
  );
  if (slots === null) {
    return null;
  }

  return [slots];
};
