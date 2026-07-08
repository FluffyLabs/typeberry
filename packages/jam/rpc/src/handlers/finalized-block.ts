import type { Handler } from "@typeberry/rpc-validation";
import { bestBlock } from "./best-block.js";

/**
 * https://github.com/polkadot-fellows/JIPs/blob/772ce90bfc33f4e1de9de3bbe10c561753cc0d41/JIP-2.md#finalizedblock
 */
export const finalizedBlock: Handler<"finalizedBlock"> = async (params, context) => {
  return bestBlock(params, context); // todo [seko] implement finalized block logic once finality is there
};
