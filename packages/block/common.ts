import type { Blake2bHash } from "@typeberry/hash";
import { type U16, type U32, type U64, tryAsU16, tryAsU32 } from "@typeberry/numbers";
import { type Opaque, asOpaqueType } from "@typeberry/utils";

/**
 * Time slot index.
 *
 * "an index of a six-second timeslots from the JAM Common Era"
 *
 * https://graypaper.fluffylabs.dev/#/387103d/0b1d000b2100
 */
export type TimeSlot = Opaque<U32, "TimeSlot[u32]">;
/** Attempt to convert a number into `TimeSlot`. */
export function tryAsTimeSlot(v: number): TimeSlot {
  return asOpaqueType(tryAsU32(v));
}

/** Index of the validator in current validators set. */
export type ValidatorIndex = Opaque<U16, "ValidatorIndex[u16]">;
/** Attempt to convert a number into `ValidatorIndex`. */
export function tryAsValidatorIndex(v: number): ValidatorIndex {
  return asOpaqueType(tryAsU16(v));
}

/** Unique service identifier. */
export type ServiceId = Opaque<U32, "ServiceId[u32]">;
/** Attempt to convert a number into `ServiceId`. */
export function tryAsServiceId(v: number): ServiceId {
  return asOpaqueType(tryAsU32(v));
}

// TODO [ToDr] Unify with `pvm/gas`.
/** Service gas - a measure of execution time/complexity. */
export type ServiceGas = Opaque<U64, "Gas[u64]">;

/** Index of the core on which the execution of the work package is done. */
export type CoreIndex = Opaque<U16, "CoreIndex[u16]">;
/** Attempt to convert a number into `CoreIndex`. */
export function tryAsCoreIndex(v: number): CoreIndex {
  return asOpaqueType(tryAsU16(v));
}

/** `eta`: epoch randomness */
export type EntropyHash = Opaque<Blake2bHash, "EntropyHash">;

/**
 * Index of an epoch.
 *
 * https://graypaper.fluffylabs.dev/#/c71229b/0b20000b2300
 */
export type Epoch = Opaque<U32, "Epoch">;
/** Attempt to convert a number into `Epoch`. */
export function tryAsEpoch(v: number): Epoch {
  return asOpaqueType(tryAsU32(v));
}
