import z from "zod";
import { BestBlockParams, bestBlock } from "./methods/best-block.js";
import { ListServicesParams, listServices } from "./methods/list-services.js";
import { ParentParams, parent } from "./methods/parent.js";
import { ServiceDataParams, serviceData } from "./methods/service-data.js";
import { ServicePreimageParams, servicePreimage } from "./methods/service-preimage.js";
import { ServiceRequestParams, serviceRequest } from "./methods/service-request.js";
import { ServiceValueParams, serviceValue } from "./methods/service-value.js";
import { StateRootParams, stateRoot } from "./methods/state-root.js";
import { StatisticsParams, statistics } from "./methods/statistics.js";
import { RpcError, type RpcMethod, type RpcMethodRepo } from "./types.js";
import { parameters, ParametersParams } from "./methods/parameters.js";

export const MethodNotImplementedParams = z.any();
export type MethodNotImplementedParams = z.infer<typeof MethodNotImplementedParams>;

export const methodNotImplemented: RpcMethod<MethodNotImplementedParams, []> = () => {
  throw new RpcError(-32601, "Method not implemented");
};

export const methods: RpcMethodRepo = new Map([
  ["beefyRoot", [methodNotImplemented, MethodNotImplementedParams]], // todo [seko] beefy root needs to be stored in the db first, also awaits chapter 12
  ["bestBlock", [bestBlock, BestBlockParams]],
  ["finalizedBlock", [bestBlock, BestBlockParams]], // todo [seko] implement when finality is implemented
  ["listServices", [listServices, ListServicesParams]],
  ["parameters", [parameters, ParametersParams]],
  ["parent", [parent, ParentParams]],
  ["serviceData", [serviceData, ServiceDataParams]],
  ["servicePreimage", [servicePreimage, ServicePreimageParams]],
  ["serviceRequest", [serviceRequest, ServiceRequestParams]],
  ["serviceValue", [serviceValue, ServiceValueParams]],
  ["stateRoot", [stateRoot, StateRootParams]],
  ["statistics", [statistics, StatisticsParams]],
  ["submitPreimage", [methodNotImplemented, MethodNotImplementedParams]],
  ["submitWorkPackage", [methodNotImplemented, MethodNotImplementedParams]],
]);
