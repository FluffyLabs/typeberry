import { type ServiceId, tryAsServiceId } from "@typeberry/block";
import { tryAsU32, tryAsU64, type U32, type U64, u32AsLeBytes, u64IntoParts } from "@typeberry/numbers";
import type { HostCallRegisters } from "@typeberry/pvm-host-calls";
import { NO_OF_REGISTERS, REGISTER_BYTE_SIZE } from "@typeberry/pvm-interface";
import { check, safeAllocUint8Array } from "@typeberry/utils";

const MAX_U32 = tryAsU32(2 ** 32 - 1);
const MAX_U32_BIG_INT = tryAsU64(MAX_U32);
export const SERVICE_ID_BYTES = 4;
export const CURRENT_SERVICE_ID = tryAsServiceId(2 ** 32 - 1);

export function getServiceIdOrCurrent(
  regNumber: number,
  regs: HostCallRegisters,
  currentServiceId: ServiceId,
): ServiceId | null {
  const regValue = regs.get(regNumber);
  if (regValue === 2n ** 64n - 1n) {
    return currentServiceId;
  }

  return getServiceId(regValue);
}

export function getServiceId(serviceId: U64): ServiceId | null {
  const { lower, upper } = u64IntoParts(serviceId);

  if (upper === 0) {
    return tryAsServiceId(lower);
  }

  return null;
}

export function writeServiceIdAsLeBytes(serviceId: ServiceId, destination: Uint8Array) {
  check`${destination.length >= SERVICE_ID_BYTES} Not enough space in the destination.`;
  destination.set(u32AsLeBytes(serviceId));
}

/** Clamp a U64 to the maximum value of a 32-bit unsigned integer. */
export function clampU64ToU32(value: U64): U32 {
  return value > MAX_U32_BIG_INT ? MAX_U32 : tryAsU32(Number(value));
}

export function emptyRegistersBuffer(): Uint8Array {
  return safeAllocUint8Array(NO_OF_REGISTERS * REGISTER_BYTE_SIZE);
}
