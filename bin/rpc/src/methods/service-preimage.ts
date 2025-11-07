import { type HeaderHash, tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import z from "zod";
import { BlobArray, Hash, RpcError, RpcErrorCode, ServiceId, withValidation } from "../types.js";

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
export const servicePreimage = withValidation(
  async ([headerHash, serviceId, preimageHash], db) => {
    const hashOpaque: HeaderHash = Bytes.fromBlob(headerHash, HASH_SIZE).asOpaque();
    const state = db.states.getState(hashOpaque);

    if (state === null) {
      throw new RpcError(RpcErrorCode.Other, `State not found for block: ${hashOpaque.toString()}`);
    }

    const service = state.getService(tryAsServiceId(serviceId));

    if (service === null) {
      throw new RpcError(RpcErrorCode.Other, `Service not found: ${serviceId.toString()}`);
    }

    const preimage = service.getPreimage(Bytes.fromBlob(preimageHash, HASH_SIZE).asOpaque());

    if (preimage === null) {
      return null;
    }

    return preimage.raw;
  },
  z.tuple([Hash, ServiceId, Hash]),
  z.union([BlobArray, z.null()]),
);
