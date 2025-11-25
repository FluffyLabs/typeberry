import type { Handler } from "../types.js";

export const subscribeServiceData: Handler<"subscribeServiceData"> = async (params, { subscription }) => {
  return subscription.subscribe("serviceData", params);
};
