import type { HeaderHash } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import z from "zod";
import { Hash, RpcError, RpcErrorCode, ServiceId, withValidation } from "../types.js";

/**
 * https://hackmd.io/@polkadot/jip2#listServices
 * Returns a list of all services currently known to be on JAM. This is a best-effort list and may not
 * reflect the true state. Nodes could e.g. reasonably hide services which are not recently active from
 * this list.
 * @param [
 *   Hash - The header hash indicating the block whose posterior state should be used for the query.
 * ]
 * @returns array of ServiceId
 */
export const listServices = withValidation(z.tuple([Hash]), z.array(ServiceId), async ([headerHash], db) => {
  const hashOpaque: HeaderHash = Bytes.fromBlob(headerHash, HASH_SIZE).asOpaque();
  const state = db.states.getState(hashOpaque);

  if (state === null) {
    throw new RpcError(RpcErrorCode.Other, `Posterior state not found for block: ${hashOpaque.toString()}`);
  }

  const serviceIds = state.recentServiceIds();

  return [...serviceIds];
});
