import { beefyRoot } from "./methods/beefy-root";
import { bestBlock } from "./methods/best-block";
import { finalizedBlock } from "./methods/finalized-block";
import { listServices } from "./methods/list-services";
import { parameters } from "./methods/parameters";
import { parent } from "./methods/parent";
import { serviceData } from "./methods/service-data";
import { servicePreimage } from "./methods/service-preimage";
import { serviceRequest } from "./methods/service-request";
import { serviceValue } from "./methods/service-value";
import { stateRoot } from "./methods/state-root";
import { statistics } from "./methods/statistics";
import { submitPreimage } from "./methods/submit-preimage";
import { submitWorkPackage } from "./methods/submit-work-package";
import { subscribeBestBlock } from "./methods/subscribe-best-block";
import { subscribeFinalizedBlock } from "./methods/subscribe-finalized-block";
import { subscribeServiceData } from "./methods/subscribe-service-data";
import { subscribeServicePreimage } from "./methods/subscribe-service-preimage";
import { subscribeServiceRequest } from "./methods/subscribe-service-request";
import { subscribeServiceValue } from "./methods/subscribe-service-value";
import { subscribeStatistics } from "./methods/subscribe-statistics";
import type { RpcMethod } from "./types";

// biome-ignore lint/suspicious/noExplicitAny: the map must be able to store methods with any parameters and return values
export function loadMethodsInto(methods: Map<string, RpcMethod<any, any>>): void {
  methods.set("beefyRoot", beefyRoot);
  methods.set("bestBlock", bestBlock);
  methods.set("finalizedBlock", finalizedBlock);
  methods.set("listServices", listServices);
  methods.set("parameters", parameters);
  methods.set("parent", parent);
  methods.set("serviceData", serviceData);
  methods.set("servicePreimage", servicePreimage);
  methods.set("serviceRequest", serviceRequest);
  methods.set("serviceValue", serviceValue);
  methods.set("stateRoot", stateRoot);
  methods.set("statistics", statistics);
  methods.set("submitPreimage", submitPreimage);
  methods.set("submitWorkPackage", submitWorkPackage);
  methods.set("subscribeBestBlock", subscribeBestBlock);
  methods.set("subscribeFinalizedBlock", subscribeFinalizedBlock);
  methods.set("subscribeServiceData", subscribeServiceData);
  methods.set("subscribeServicePreimage", subscribeServicePreimage);
  methods.set("subscribeServiceRequest", subscribeServiceRequest);
  methods.set("subscribeServiceValue", subscribeServiceValue);
  methods.set("subscribeStatistics", subscribeStatistics);
}
