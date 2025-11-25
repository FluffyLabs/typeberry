import type { Handler } from "../types.js";

export const subscribeServicePreimage: Handler<"subscribeServicePreimage"> = async (params, { subscription }) => {
  return subscription.subscribe("servicePreimage", params);
};
