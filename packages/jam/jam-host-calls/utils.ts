import { type ServiceId, tryAsServiceId } from "@typeberry/block";
import {writeU32} from "@typeberry/numbers";
import type { Registers } from "@typeberry/pvm-host-calls/host-call-handler";

export const CURRENT_SERVICE_ID = tryAsServiceId(2 ** 32 - 1);

export function getServiceId(regNumber: number, regs: Registers, currentServiceId: ServiceId) {
  const serviceId = regs.getU32(regNumber);
  return serviceId === CURRENT_SERVICE_ID ? currentServiceId : (serviceId as ServiceId);
}

export function writeServiceIdAsLeBytes(serviceId: ServiceId, destination: Uint8Array) {
  return writeU32(destination, serviceId);
}
