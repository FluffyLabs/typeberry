import { type ServiceId, tryAsServiceId } from "@typeberry/block";
import { MAX_U64, tryAsU64, u64IntoParts } from "@typeberry/numbers";
import type { Registers } from "@typeberry/pvm-host-calls/host-call-handler";
import { check } from "@typeberry/utils";

export const SERVICE_ID_BYTES = 4;
export const CURRENT_SERVICE_ID = tryAsServiceId(2 ** 32 - 1);

export function legacyGetServiceId(regNumber: number, regs: Registers, currentServiceId: ServiceId) {
  const serviceId = regs.getU32(regNumber);
  return serviceId === CURRENT_SERVICE_ID ? currentServiceId : (serviceId as ServiceId);
}

export function getServiceId(regNumber: number, regs: Registers, currentServiceId: ServiceId): ServiceId | null {
  const omega_7 = regs.getU64(regNumber);
  if (omega_7 === MAX_U64) {
    return currentServiceId;
  }

  const { lower, upper } = u64IntoParts(tryAsU64(omega_7));

  if (upper === 0) {
    return tryAsServiceId(lower);
  }
  return null;
}

export function writeServiceIdAsLeBytes(serviceId: ServiceId, destination: Uint8Array) {
  check(destination.length >= SERVICE_ID_BYTES, "Not enough space in the destination.");
  let serviceIdBytes = serviceId as number;
  for (let i = 0; i < SERVICE_ID_BYTES; i += 1) {
    destination[i] = serviceIdBytes & 0xff;
    serviceIdBytes >>>= 8;
  }
}
