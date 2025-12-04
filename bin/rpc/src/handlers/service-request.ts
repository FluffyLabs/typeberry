import { type HeaderHash, tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU32 } from "@typeberry/numbers";
import type { Handler } from "@typeberry/rpc-validation";

/**
 * https://github.com/polkadot-fellows/JIPs/blob/772ce90bfc33f4e1de9de3bbe10c561753cc0d41/JIP-2.md#servicerequestheader_hash-id-hash-len
 */
export const serviceRequest: Handler<"serviceRequest"> = async (
  [headerHash, serviceId, preimageHash, preimageLength],
  { db },
) => {
  const hashOpaque: HeaderHash = Bytes.fromBlob(headerHash, HASH_SIZE).asOpaque();
  const state = db.states.getState(hashOpaque);
  if (state === null) {
    return null;
  }

  const service = state.getService(tryAsServiceId(serviceId));
  if (service === null) {
    return null;
  }

  const slots = service.getLookupHistory(Bytes.fromBlob(preimageHash, HASH_SIZE).asOpaque(), tryAsU32(preimageLength));
  if (slots === null) {
    return null;
  }

  return slots;
};
