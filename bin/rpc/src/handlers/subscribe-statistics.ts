import { type Handler, validation } from "@typeberry/rpc-validation";
import { bestBlock } from "./best-block.js";
import { finalizedBlock } from "./finalized-block.js";
import { statistics } from "./statistics.js";

/**
 * https://github.com/polkadot-fellows/JIPs/blob/772ce90bfc33f4e1de9de3bbe10c561753cc0d41/JIP-2.md#subscribestatisticsfinalized
 */
export const subscribeStatistics: Handler<"subscribeStatistics"> = async (params, { subscription }) => {
  return subscription.subscribe(
    "subscribeStatistics",
    async ([finalized], context) => {
      const block = finalized ? await finalizedBlock([], context) : await bestBlock([], context);

      return statistics([block.header_hash], context);
    },
    validation.schemas.statistics.output,
    params,
  );
};
