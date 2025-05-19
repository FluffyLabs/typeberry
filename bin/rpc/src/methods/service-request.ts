import { type HeaderHash, tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import type { U32 } from "@typeberry/numbers";
import type { Hash, RpcMethod, ServiceId, Slot } from "../types";

export const serviceRequest: RpcMethod<[Hash, ServiceId, Hash, U32], [Slot[]] | null> = async (
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
