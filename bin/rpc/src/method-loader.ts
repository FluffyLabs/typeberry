import { bestBlock } from "./methods/best-block";
import { listServices } from "./methods/list-services";
import { parent } from "./methods/parent";
import { serviceData } from "./methods/service-data";
import { servicePreimage } from "./methods/service-preimage";
import { serviceRequest } from "./methods/service-request";
import { serviceValue } from "./methods/service-value";
import { stateRoot } from "./methods/state-root";
import { statistics } from "./methods/statistics";
import { RpcError, type RpcMethod, type RpcMethodRepo } from "./types";

export function loadMethodsInto(methods: RpcMethodRepo): void {
  methods.set("beefyRoot", methodNotImplemented); // todo [seko] beefy root needs to be stored in the db first, also awaits chapter 12
  methods.set("bestBlock", bestBlock);
  methods.set("finalizedBlock", bestBlock); // todo [seko] implement when finality is implemented
  methods.set("listServices", listServices);
  methods.set("parameters", methodNotImplemented);
  methods.set("parent", parent);
  methods.set("serviceData", serviceData);
  methods.set("servicePreimage", servicePreimage);
  methods.set("serviceRequest", serviceRequest);
  methods.set("serviceValue", serviceValue);
  methods.set("stateRoot", stateRoot);
  methods.set("statistics", statistics);
  methods.set("submitPreimage", methodNotImplemented);
  methods.set("submitWorkPackage", methodNotImplemented);
}

export const methodNotImplemented: RpcMethod<[], []> = () => {
  throw new RpcError(-32601, "Method not implemented");
};
