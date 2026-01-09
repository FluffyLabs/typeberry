import { type Handler, validation } from "@typeberry/rpc-validation";
import { bestBlock } from "./best-block.js";
import { finalizedBlock } from "./finalized-block.js";
import { servicePreimage } from "./service-preimage.js";

/**
 * https://github.com/polkadot-fellows/JIPs/blob/772ce90bfc33f4e1de9de3bbe10c561753cc0d41/JIP-2.md#subscribeservicepreimageid-hash-finalized
 */
export const subscribeServicePreimage: Handler<"subscribeServicePreimage"> = async (params, { subscription }) => {
  return subscription.subscribe(
    "subscribeServicePreimage",
    async ([serviceId, preimageHash, finalized], context) => {
      const block = finalized ? await finalizedBlock([], context) : await bestBlock([], context);

      return servicePreimage([block.header_hash, serviceId, preimageHash], context);
    },
    validation.schemas.servicePreimage.output,
    params,
  );
};
