import { type Handler, validation } from "@typeberry/rpc-validation";
import { bestBlock } from "./best-block.js";
import { finalizedBlock } from "./finalized-block.js";
import { serviceData } from "./service-data.js";

/**
 * https://github.com/polkadot-fellows/JIPs/blob/772ce90bfc33f4e1de9de3bbe10c561753cc0d41/JIP-2.md#subscribeservicedataid-finalized
 */
export const subscribeServiceData: Handler<"subscribeServiceData"> = async (params, { subscription }) => {
  return subscription.subscribe(
    "subscribeServiceData",
    async ([serviceId, finalized], context) => {
      const block = finalized ? await finalizedBlock([], context) : await bestBlock([], context);

      return serviceData([block.header_hash, serviceId], context);
    },
    validation.schemas.serviceData.output,
    params,
  );
};
