import type { HeaderHash } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import type { Hash, RpcMethod, ServiceId } from "../types";

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
export const listServices: RpcMethod<[Hash], [ServiceId[]]> = async ([headerHash], db) => {
  const hashOpaque: HeaderHash = Bytes.fromNumbers(headerHash, HASH_SIZE).asOpaque();
  const stateRoot = db.blocks.getPostStateRoot(hashOpaque);

  if (stateRoot === null) {
    throw new Error("State root not found for the given header hash.");
  }

  const state = db.states.getFullState(stateRoot);

  if (state === null) {
    throw new Error("State not found the given state root.");
  }

  const serviceIds = state.services.keys();

  return [[...serviceIds]];
};
