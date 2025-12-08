import type { Handler } from "@typeberry/rpc-validation";

/**
 * https://github.com/polkadot-fellows/JIPs/blob/772ce90bfc33f4e1de9de3bbe10c561753cc0d41/JIP-2.md#subscribeservicerequestid-hash-len-finalized
 */
export const subscribeServiceRequest: Handler<"subscribeServiceRequest"> = async (params, { subscription }) => {
  return subscription.subscribe("serviceRequest", params);
};
