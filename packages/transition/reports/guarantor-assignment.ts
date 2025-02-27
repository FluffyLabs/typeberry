/**
 * 11.3. Guarantor Assignments. Every block, each core
 * has three validators uniquely assigned to guarantee work-
 * reports for it. This is borne out with V= 1023 validators
 * and C = 341 cores, since V/C = 3. The core index assigned to
 * each of the validators, as well as the validators’ Ed25519
 * keys are denoted by G.
 *
 * https://graypaper.fluffylabs.dev/#/5f542d7/147601147e01
 */

import type { CoreIndex, EntropyHash, PerValidator, TimeSlot } from "@typeberry/block";
import { asKnownSize } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import { fisherYatesShuffle } from "@typeberry/shuffling";
import { type Opaque, asOpaqueType } from "@typeberry/utils";

/**
 * `R`: The rotation period of validator-core assignments, in timeslots.
 *
 * https://graypaper.fluffylabs.dev/#/5f542d7/417f00417f00
 */
export const ROTATION_PERIOD = 10;

/** Index of the rotation calculated by dividing a timeslot by `ROTATION_PERIOD`. */
export type RotationIndex = Opaque<number, "RotationIndex">;

/**
 * Returns core assignments for each validator index.
 *
 * https://graypaper.fluffylabs.dev/#/5f542d7/14fd0114fd01
 */
export function generateCoreAssignment(
  spec: ChainSpec,
  /** https://graypaper.fluffylabs.dev/#/5f542d7/149601149601 */
  eta2entropy: EntropyHash,
  /** timeslot */
  slot: TimeSlot,
): PerValidator<CoreIndex> {
  return permute(eta2entropy, slot, spec.epochLength, spec.validatorsCount, spec.coresCount);
}

/** Calculate rotation index for given time slot. */
export function rotationIndex(slot: TimeSlot): RotationIndex {
  return asOpaqueType(Math.floor(slot / ROTATION_PERIOD));
}

/** https://graypaper.fluffylabs.dev/#/5f542d7/14c00114c001 */
function permute(
  entropy: EntropyHash,
  slot: TimeSlot,
  epochLength: number,
  noOfValidators: number,
  noOfCores: number,
): PerValidator<CoreIndex> {
  const shift = rotationIndex((slot % epochLength) as TimeSlot);
  const initialAssignment = Array(noOfValidators)
    .fill(0)
    .map((_v, i) => {
      // we are moving within `[0..1)` in `i/noOfValidators` component, hence we will
      // get a valid `coreIndex` after multiplying by `noOfCores`.
      return Math.floor((i * noOfCores) / noOfValidators) as CoreIndex;
    });
  const shuffledAssignment = fisherYatesShuffle(initialAssignment, entropy);
  const coreAssignment = rotate(shuffledAssignment, shift, noOfCores);

  // we are sure this is PerValidator, since that's the array we create earlier.
  return asKnownSize(coreAssignment);
}

/** https://graypaper.fluffylabs.dev/#/5f542d7/14a50114a501 */
function rotate(cores: CoreIndex[], n: number, noOfCores: number) {
  // modulo `noOfCores` guarantees that we're within `CoreIndex` range.
  return cores.map((x) => asOpaqueType((x + n) % noOfCores));
}
