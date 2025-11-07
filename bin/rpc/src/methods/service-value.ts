import { type HeaderHash, tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import z from "zod";
import { BlobArray, Hash, RpcError, RpcErrorCode, ServiceId, withValidation } from "../types.js";

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
export const serviceValue = withValidation(
  async ([headerHash, serviceId, key], db) => {
    const hashOpaque: HeaderHash = Bytes.fromBlob(headerHash, HASH_SIZE).asOpaque();
    const state = db.states.getState(hashOpaque);

    if (state === null) {
      throw new RpcError(RpcErrorCode.Other, `State not found for block: ${hashOpaque.toString()}`);
    }

    const service = state.getService(tryAsServiceId(serviceId));

    if (service === null) {
      return null;
    }

    const storageValue = service.getStorage(Bytes.fromBlob(key, HASH_SIZE).asOpaque());

    if (storageValue === null) {
      return null;
    }

    return storageValue.raw;
  },
  z.tuple([Hash, ServiceId, BlobArray]),
  z.union([BlobArray, z.null()]),
);
