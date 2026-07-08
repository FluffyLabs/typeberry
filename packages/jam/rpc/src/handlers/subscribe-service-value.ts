import { type Handler, validation } from "@typeberry/rpc-validation";
import { bestBlock } from "./best-block.js";
import { finalizedBlock } from "./finalized-block.js";
import { serviceValue } from "./service-value.js";

/**
 * https://github.com/polkadot-fellows/JIPs/blob/772ce90bfc33f4e1de9de3bbe10c561753cc0d41/JIP-2.md#subscribeservicevalueid-key-finalized
 */
export const subscribeServiceValue: Handler<"subscribeServiceValue"> = async (params, { subscription }) => {
  return subscription.subscribe(
    "subscribeServiceValue",
    async ([serviceId, key, finalized], context) => {
      const block = finalized ? await finalizedBlock([], context) : await bestBlock([], context);

      return serviceValue([block.header_hash, serviceId, key], context);
    },
    validation.schemas.serviceValue.output,
    params,
  );
};
