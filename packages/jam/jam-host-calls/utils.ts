import { type ServiceId, tryAsServiceId } from "@typeberry/block";
import { u64IntoParts } from "@typeberry/numbers";
import { u32AsLeBytes } from "@typeberry/numbers";
import type { HostCallRegisters } from "@typeberry/pvm-host-calls";
import { check } from "@typeberry/utils";

export const SERVICE_ID_BYTES = 4;
export const CURRENT_SERVICE_ID = tryAsServiceId(2 ** 32 - 1);
/**
 * Magic number to indicate that the serviceId is currentServiceId.
 *
 * https://graypaper.fluffylabs.dev/#/cc517d7/305d00306100?v=0.6.5
 */
export const PLACEHOLDER_SERVICE_ID = 2n ** 64n - 1n;

export function legacyGetServiceId(regNumber: number, regs: HostCallRegisters, currentServiceId: ServiceId) {
  const serviceId = Number(regs.get(regNumber));
  return serviceId === CURRENT_SERVICE_ID ? currentServiceId : tryAsServiceId(serviceId);
}

export function getServiceId(
  regNumber: number,
  regs: HostCallRegisters,
  currentServiceId: ServiceId,
): ServiceId | null {
  const regValue = regs.get(regNumber);
  if (regValue === PLACEHOLDER_SERVICE_ID) {
    return currentServiceId;
  }

  const { lower, upper } = u64IntoParts(regValue);

  if (upper === 0) {
    return tryAsServiceId(lower);
  }
  return null;
}

export function writeServiceIdAsLeBytes(serviceId: ServiceId, destination: Uint8Array) {
  check(destination.length >= SERVICE_ID_BYTES, "Not enough space in the destination.");
  destination.set(u32AsLeBytes(serviceId));
}
