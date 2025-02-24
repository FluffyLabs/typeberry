import { type KnownSizeArray, asKnownSize } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import type { Blake2bHash, OpaqueHash } from "@typeberry/hash";
import { type U16, type U32, type U64, tryAsU16, tryAsU32 } from "@typeberry/numbers";
import { type Opaque, asOpaqueType, check } from "@typeberry/utils";

/**
 * Time slot index.
 *
 * "an index of a six-second timeslots from the JAM Common Era"
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/0b46000b4a00
 */
export type TimeSlot = Opaque<U32, "TimeSlot[u32]">;
/** Attempt to convert a number into `TimeSlot`. */
export const tryAsTimeSlot = (v: number): TimeSlot => asOpaqueType(tryAsU32(v));

/** Index of the validator in current validators set. */
export type ValidatorIndex = Opaque<U16, "ValidatorIndex[u16]">;
/** Attempt to convert a number into `ValidatorIndex`. */
export const tryAsValidatorIndex = (v: number): ValidatorIndex => asOpaqueType(tryAsU16(v));

/** Unique service identifier. */
export type ServiceId = Opaque<U32, "ServiceId[u32]">;
/** Attempt to convert a number into `ServiceId`. */
export const tryAsServiceId = (v: number): ServiceId => asOpaqueType(tryAsU32(v));

// TODO [ToDr] Unify with `pvm/gas`.
/** Service gas - a measure of execution time/complexity. */
export type ServiceGas = Opaque<U64, "Gas[u64]">;

/** Index of the core on which the execution of the work package is done. */
export type CoreIndex = Opaque<U16, "CoreIndex[u16]">;
/** Attempt to convert a number into `CoreIndex`. */
export const tryAsCoreIndex = (v: number): CoreIndex => asOpaqueType(tryAsU16(v));

/** `eta`: epoch randomness */
export type EntropyHash = Opaque<Blake2bHash, "EntropyHash">;

/** Hash of the merkle root of the state. */
export type StateRootHash = Opaque<OpaqueHash, "StateRootHash">;

/**
 * Index of an epoch.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/0b39000b3c00
 */
export type Epoch = Opaque<U32, "Epoch">;
/** Attempt to convert a number into `Epoch`. */
export const tryAsEpoch = (v: number): Epoch => asOpaqueType(tryAsU32(v));

/** One entry of `T` per one validator. */
export type PerValidator<T> = KnownSizeArray<T, "ValidatorsCount">;
export function tryAsPerValidator<T>(array: T[], spec: ChainSpec): PerValidator<T> {
  check(
    array.length === spec.validatorsCount,
    `Invalid per-validator array length. Expected ${spec.validatorsCount}, got: ${array.length}`,
  );
  return asKnownSize(array);
}

/** One entry of `T` per one block in epoch. */
export type PerEpochBlock<T> = KnownSizeArray<T, "EpochLength">;
export function tryAsPerEpochBlock<T>(array: T[], spec: ChainSpec): PerEpochBlock<T> {
  check(
    array.length === spec.epochLength,
    `Invalid per-epoch-block array length. Expected ${spec.epochLength}, got: ${array.length}`,
  );
  return asKnownSize(array);
}
