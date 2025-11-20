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
export const finalizedBlock: Handler<"finalizedBlock"> = async (params, db, chainSpec) => {
  return bestBlock(params, db, chainSpec); // todo [seko] implement finalized block logic once finality is there
};
