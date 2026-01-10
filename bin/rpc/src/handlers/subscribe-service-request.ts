import { type Handler, validation } from "@typeberry/rpc-validation";
import { bestBlock } from "./best-block.js";
import { finalizedBlock } from "./finalized-block.js";
import { serviceRequest } from "./service-request.js";

/**
 * https://github.com/polkadot-fellows/JIPs/blob/772ce90bfc33f4e1de9de3bbe10c561753cc0d41/JIP-2.md#subscribeservicerequestid-hash-len-finalized
 */
export const subscribeServiceRequest: Handler<"subscribeServiceRequest"> = async (params, { subscription }) => {
  return subscription.subscribe(
    "subscribeServiceRequest",
    async ([serviceId, preimageHash, preimageLength, finalized], context) => {
      const block = finalized ? await finalizedBlock([], context) : await bestBlock([], context);

      return serviceRequest([block.header_hash, serviceId, preimageHash, preimageLength], context);
    },
    validation.schemas.serviceRequest.output,
    params,
  );
};
