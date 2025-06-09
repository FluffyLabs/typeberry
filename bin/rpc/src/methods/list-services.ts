import type { HeaderHash } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import z from "zod";
import { Hash, type RpcMethod, type ServiceId } from "../types";

export const ListServicesParams = z.tuple([Hash]);
export type ListServicesParams = z.infer<typeof ListServicesParams>;

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
export const listServices: RpcMethod<ListServicesParams, [ServiceId[]]> = async ([headerHash], db) => {
  const hashOpaque: HeaderHash = Bytes.fromNumbers(headerHash, HASH_SIZE).asOpaque();
  const state = db.states.getState(hashOpaque);

  if (state === null) {
    throw new Error("State not found the given state root.");
  }

  const serviceIds = state.recentServiceIds();

  return [[...serviceIds]];
};
