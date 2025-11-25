import type { Handler } from "../types.js";

export const subscribeFinalizedBlock: Handler<"subscribeFinalizedBlock"> = async (params, { subscription }) => {
  return subscription.subscribe("finalizedBlock", params);
};
