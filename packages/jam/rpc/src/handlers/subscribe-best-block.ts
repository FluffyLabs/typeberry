import { type Handler, validation } from "@typeberry/rpc-validation";
import { bestBlock } from "./best-block.js";

/**
 * https://github.com/polkadot-fellows/JIPs/blob/772ce90bfc33f4e1de9de3bbe10c561753cc0d41/JIP-2.md#subscribebestblock
 */
export const subscribeBestBlock: Handler<"subscribeBestBlock"> = async (params, { subscription }) => {
  return subscription.subscribe("subscribeBestBlock", bestBlock, validation.schemas.bestBlock.output, params);
};
