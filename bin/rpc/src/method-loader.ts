import z from "zod";
import { BestBlockParams, bestBlock } from "./methods/best-block";
import { ListServicesParams, listServices } from "./methods/list-services";
import { ParentParams, parent } from "./methods/parent";
import { ServiceDataParams, serviceData } from "./methods/service-data";
import { ServicePreimageParams, servicePreimage } from "./methods/service-preimage";
import { ServiceRequestParams, serviceRequest } from "./methods/service-request";
import { ServiceValueParams, serviceValue } from "./methods/service-value";
import { StateRootParams, stateRoot } from "./methods/state-root";
import { StatisticsParams, statistics } from "./methods/statistics";
import { RpcError, type RpcMethod, type RpcMethodRepo } from "./types";

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
  ["parameters", [methodNotImplemented, MethodNotImplementedParams]],
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
