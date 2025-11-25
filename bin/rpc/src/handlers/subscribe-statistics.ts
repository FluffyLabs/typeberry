import type { Handler } from "../types.js";

export const subscribeStatistics: Handler<"subscribeStatistics"> = async (params, { subscription }) => {
  return subscription.subscribe("statistics", params);
};
