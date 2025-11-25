import type { Handler } from "../types.js";
import { bestBlock } from "./best-block.js";

export const finalizedBlock: Handler<"finalizedBlock"> = async (params, context) => {
  return bestBlock(params, context); // todo [seko] implement finalized block logic once finality is there
};
