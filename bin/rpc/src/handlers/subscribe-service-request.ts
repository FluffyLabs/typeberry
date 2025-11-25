import type { Handler } from "../types.js";

export const subscribeServiceRequest: Handler<"subscribeServiceRequest"> = async (params, { subscription }) => {
  return subscription.subscribe("serviceRequest", params);
};
