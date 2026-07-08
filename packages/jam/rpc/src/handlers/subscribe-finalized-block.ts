import { type Handler, validation } from "@typeberry/rpc-validation";
import { finalizedBlock } from "./finalized-block.js";

/**
 * https://github.com/polkadot-fellows/JIPs/blob/772ce90bfc33f4e1de9de3bbe10c561753cc0d41/JIP-2.md#subscribefinalizedblock
 */
export const subscribeFinalizedBlock: Handler<"subscribeFinalizedBlock"> = async (params, { subscription }) => {
  return subscription.subscribe(
    "subscribeFinalizedBlock",
    finalizedBlock,
    validation.schemas.finalizedBlock.output,
    params,
  );
};
