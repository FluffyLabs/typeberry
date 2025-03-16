import { type ServiceId, tryAsServiceId } from "@typeberry/block";
import { u32AsLeBytes } from "@typeberry/numbers";
import type { Registers } from "@typeberry/pvm-host-calls/host-call-handler";
import { check } from "@typeberry/utils";

export const SERVICE_ID_BYTES = 4;
export const CURRENT_SERVICE_ID = tryAsServiceId(2 ** 32 - 1);

export function getServiceId(regNumber: number, regs: Registers, currentServiceId: ServiceId) {
  const serviceId = regs.getU32(regNumber);
  return serviceId === CURRENT_SERVICE_ID ? currentServiceId : (serviceId as ServiceId);
}

export function writeServiceIdAsLeBytes(serviceId: ServiceId, destination: Uint8Array) {
  check(destination.length >= SERVICE_ID_BYTES, "Not enough space in the destination.");
  destination.set(u32AsLeBytes(serviceId));
}
