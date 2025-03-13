import { type ServiceId, tryAsServiceId } from "@typeberry/block";
import type { Registers } from "@typeberry/pvm-host-calls/host-call-handler";
import { check } from "@typeberry/utils";

export const SERVICE_ID_BYTES = 4;
export const LEGACY_CURRENT_SERVICE_ID = tryAsServiceId(2 ** 32 - 1);
export const CURRENT_SERVICE_ID = 2n ** 64n - 1n;

export function legacyGetServiceId(regNumber: number, regs: Registers, currentServiceId: ServiceId) {
  const serviceId = regs.getU32(regNumber);
  return serviceId === LEGACY_CURRENT_SERVICE_ID ? currentServiceId : (serviceId as ServiceId);
}

export function getServiceId(regNumber: number, regs: Registers, currentServiceId: ServiceId): ServiceId | null {
  const serviceId = regs.getU64(regNumber);
  if (serviceId === CURRENT_SERVICE_ID) {
    return currentServiceId;
  }
  try {
    return tryAsServiceId(Number(serviceId));
  } catch (_err) {
    return null;
  }
}

export function writeServiceIdAsLeBytes(serviceId: ServiceId, destination: Uint8Array) {
  check(destination.length >= SERVICE_ID_BYTES, "Not enough space in the destination.");
  let serviceIdBytes = serviceId as number;
  for (let i = 0; i < SERVICE_ID_BYTES; i += 1) {
    destination[i] = serviceIdBytes & 0xff;
    serviceIdBytes >>>= 8;
  }
}
