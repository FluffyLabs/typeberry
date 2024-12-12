import { type ServiceId, tryAsServiceId } from "@typeberry/block";
import type { Registers } from "@typeberry/pvm-host-calls/host-call-handler";
import { check } from "@typeberry/utils";

export const SERVICE_ID_BYTES = 4;
export const CURRENT_SERVICE_ID = tryAsServiceId(2 ** 32 - 1);

export function getServiceId(regNumber: number, regs: Registers, currentServiceId: ServiceId) {
  const serviceId = regs.asUnsigned[regNumber];
  return serviceId === CURRENT_SERVICE_ID ? currentServiceId : (serviceId as ServiceId);
}

export function writeServiceIdAsLeBytes(serviceId: ServiceId, destination: Uint8Array) {
  check(destination.length >= SERVICE_ID_BYTES, "Not enough space in the destination.");
  let serviceIdBytes = serviceId as number;
  for (let i = 0; i < SERVICE_ID_BYTES; i += 1) {
    destination[i] = serviceIdBytes & 0xff;
    serviceIdBytes >>>= 8;
  }
}
