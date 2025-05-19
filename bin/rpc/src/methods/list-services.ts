import type { HeaderHash } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import type { Hash, RpcMethod, ServiceId } from "../types";

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
