import type { HandlerMap } from "@typeberry/rpc-validation";
import { bestBlock } from "./handlers/best-block.js";
import { finalizedBlock } from "./handlers/finalized-block.js";
import { listServices } from "./handlers/list-services.js";
import { notImplemented } from "./handlers/not-implemented.js";
import { parameters } from "./handlers/parameters.js";
import { parent } from "./handlers/parent.js";
import { serviceData } from "./handlers/service-data.js";
import { servicePreimage } from "./handlers/service-preimage.js";
import { serviceRequest } from "./handlers/service-request.js";
import { serviceValue } from "./handlers/service-value.js";
import { stateRoot } from "./handlers/state-root.js";
import { statistics } from "./handlers/statistics.js";
import { subscribeBestBlock } from "./handlers/subscribe-best-block.js";
import { subscribeFinalizedBlock } from "./handlers/subscribe-finalized-block.js";
import { subscribeServiceData } from "./handlers/subscribe-service-data.js";
import { subscribeServicePreimage } from "./handlers/subscribe-service-preimage.js";
import { subscribeServiceRequest } from "./handlers/subscribe-service-request.js";
import { subscribeServiceValue } from "./handlers/subscribe-service-value.js";
import { subscribeStatistics } from "./handlers/subscribe-statistics.js";
import { unsubscribe } from "./handlers/unsubscribe.js";

export const handlers: HandlerMap = {
  beefyRoot: notImplemented,
  bestBlock,
  finalizedBlock,
  listServices,
  parameters,
  parent,
  serviceData,
  servicePreimage,
  serviceRequest,
  serviceValue,
  stateRoot,
  statistics,
  submitPreimage: notImplemented,
  submitWorkPackage: notImplemented,
  subscribeBestBlock,
  subscribeFinalizedBlock,
  subscribeServiceData,
  subscribeServicePreimage,
  subscribeServiceRequest,
  subscribeServiceValue,
  subscribeStatistics,
  unsubscribeBestBlock: unsubscribe,
  unsubscribeFinalizedBlock: unsubscribe,
  unsubscribeServiceData: unsubscribe,
  unsubscribeServicePreimage: unsubscribe,
  unsubscribeServiceRequest: unsubscribe,
  unsubscribeServiceValue: unsubscribe,
  unsubscribeStatistics: unsubscribe,
};
