import { type ServiceId, tryAsServiceId } from "@typeberry/block";
import { u64IntoParts } from "@typeberry/numbers";
import { u32AsLeBytes } from "@typeberry/numbers";
import type { HostCallRegisters } from "@typeberry/pvm-host-calls";
import { check } from "@typeberry/utils";

export const SERVICE_ID_BYTES = 4;
export const CURRENT_SERVICE_ID = tryAsServiceId(2 ** 32 - 1);

export function legacyGetServiceId(regNumber: number, regs: HostCallRegisters, currentServiceId: ServiceId) {
  const serviceId = Number(regs.get(regNumber));
  return serviceId === CURRENT_SERVICE_ID ? currentServiceId : tryAsServiceId(serviceId);
}

export function getServiceId(regNumber: number, regs: HostCallRegisters, currentServiceId: ServiceId): ServiceId {
  const regValue = regs.get(regNumber);
  if (regValue === 2n ** 64n - 1n) {
    return currentServiceId;
  }

  const { lower } = u64IntoParts(regValue);

  return tryAsServiceId(lower);
}

export function writeServiceIdAsLeBytes(serviceId: ServiceId, destination: Uint8Array) {
  check(destination.length >= SERVICE_ID_BYTES, "Not enough space in the destination.");
  destination.set(u32AsLeBytes(serviceId));
}
