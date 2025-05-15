import { type ServiceId, tryAsServiceId } from "@typeberry/block";
import { type U32, type U64, tryAsU32, tryAsU64, u64IntoParts } from "@typeberry/numbers";
import { u32AsLeBytes } from "@typeberry/numbers";
import type { IHostCallRegisters } from "@typeberry/pvm-host-calls";
import { check } from "@typeberry/utils";

const MAX_U32 = tryAsU32(2 ** 32 - 1);
const MAX_U32_BIG_INT = tryAsU64(MAX_U32);
export const SERVICE_ID_BYTES = 4;
export const CURRENT_SERVICE_ID = tryAsServiceId(2 ** 32 - 1);

export function legacyGetServiceId(regNumber: number, regs: IHostCallRegisters, currentServiceId: ServiceId) {
  const serviceId = Number(regs.get(regNumber));
  return serviceId === CURRENT_SERVICE_ID ? currentServiceId : tryAsServiceId(serviceId);
}

export function getServiceId(
  regNumber: number,
  regs: IHostCallRegisters,
  currentServiceId: ServiceId,
): ServiceId | null {
  const regValue = regs.get(regNumber);
  if (regValue === 2n ** 64n - 1n) {
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

/** Clamp a U64 to the maximum value of a 32-bit unsigned integer. */
export function clampU64ToU32(value: U64): U32 {
  return value > MAX_U32_BIG_INT ? MAX_U32 : tryAsU32(Number(value));
}
