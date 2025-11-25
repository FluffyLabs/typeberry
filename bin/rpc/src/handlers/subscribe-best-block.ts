import type { Handler } from "../types.js";

export const subscribeBestBlock: Handler<"subscribeBestBlock"> = async (params, { subscription }) => {
  return subscription.subscribe("bestBlock", params);
};
