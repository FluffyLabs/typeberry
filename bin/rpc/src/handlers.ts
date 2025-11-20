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
import type { HandlerMap } from "./types.js";

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
};
