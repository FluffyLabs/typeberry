import type { Handler } from "../types.js";
import { bestBlock } from "./best-block.js";

/**
 * https://hackmd.io/@polkadot/jip2#bestBlock
 * Returns the header hash and slot of the head of the "best" chain.
 * @returns [
 *   Hash - The header hash,
 *   Slot - The slot,
 * ]
 */
export const finalizedBlock: Handler<"finalizedBlock"> = async (params, context) => {
  return bestBlock(params, context); // todo [seko] implement finalized block logic once finality is there
};
