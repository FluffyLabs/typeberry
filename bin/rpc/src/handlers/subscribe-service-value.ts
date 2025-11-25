import type { Handler } from "../types.js";

export const subscribeServiceValue: Handler<"subscribeServiceValue"> = async (params, { subscription }) => {
  return subscription.subscribe("serviceValue", params);
};
