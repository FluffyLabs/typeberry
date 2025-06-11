import { type HeaderHash, tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { Encoder } from "@typeberry/codec";
import { HASH_SIZE } from "@typeberry/hash";
import { ServiceAccountInfo } from "@typeberry/state";
import z from "zod";
import { type BlobArray, Hash, type None, type RpcMethod, ServiceId } from "../types.js";

export const ServiceDataParams = z.tuple([Hash, ServiceId]);
export type ServiceDataParams = z.infer<typeof ServiceDataParams>;

/**
 * https://hackmd.io/@polkadot/jip2#serviceData
 * Returns the service data for the given service ID. The data are encoded as per the GP. `null` is
 * returned if the block's posterior state is not known. `Some(None)` is returned if there is no value
 * associated with the given service ID.
 * @param [
 *   Hash - The header hash indicating the block whose posterior state should be used for the query.
 *   ServiceId - The ID of the service.
 * ]
 * @returns Either null or Blob
 */
export const serviceData: RpcMethod<ServiceDataParams, [BlobArray] | None | null> = async (
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
