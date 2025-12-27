/**
 * 11.3. Guarantor Assignments. Every block, each core
 * has three validators uniquely assigned to guarantee work-
 * reports for it. This is borne out with V= 1023 validators
 * and C = 341 cores, since V/C = 3. The core index assigned to
 * each of the validators, as well as the validators’ Ed25519
 * keys are denoted by M.
 *
 * https://graypaper.fluffylabs.dev/#/ab2cdbd/144c02145402?v=0.7.2
 */

import {
  type CoreIndex,
  type EntropyHash,
  type PerValidator,
  type TimeSlot,
  tryAsCoreIndex,
  tryAsTimeSlot,
} from "@typeberry/block";
import { asKnownSize } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import type { Blake2b } from "@typeberry/hash";
import { fisherYatesShuffle } from "@typeberry/shuffling";
import { asOpaqueType, type Opaque } from "@typeberry/utils";

/** Index of the rotation calculated by dividing a timeslot by rotation period. */
export type RotationIndex = Opaque<number, "RotationIndex">;

/**
 * Returns core assignments for each validator index.
 *
 * https://graypaper.fluffylabs.dev/#/ab2cdbd/155300155d00?v=0.7.2
 */
export function generateCoreAssignment(
  spec: ChainSpec,
  blake2b: Blake2b,
  /** https://graypaper.fluffylabs.dev/#/ab2cdbd/147102147102?v=0.7.2 */
  eta2entropy: EntropyHash,
  /** timeslot */
  slot: TimeSlot,
): PerValidator<CoreIndex> {
  return permute(blake2b, eta2entropy, slot, spec);
}

/** Calculate rotation index for given time slot. */
export function rotationIndex(slot: TimeSlot, rotationPeriod: number): RotationIndex {
  return asOpaqueType(Math.floor(slot / rotationPeriod));
}

/** https://graypaper.fluffylabs.dev/#/ab2cdbd/151900151900?v=0.7.2 */
function permute(
  blake2b: Blake2b,
  entropy: EntropyHash,
  slot: TimeSlot,
  spec: Pick<ChainSpec, "epochLength" | "rotationPeriod" | "coresCount" | "validatorsCount">,
): PerValidator<CoreIndex> {
  const shift = rotationIndex(tryAsTimeSlot(slot % spec.epochLength), spec.rotationPeriod);
  const initialAssignment = Array(spec.validatorsCount)
    .fill(0)
    .map((_v, i) => {
      // we are moving within `[0..1)` in `i/noOfValidators` component, hence we will
      // get a valid `coreIndex` after multiplying by `noOfCores`.
      return tryAsCoreIndex(Math.floor((i * spec.coresCount) / spec.validatorsCount));
    });
  const shuffledAssignment = fisherYatesShuffle(blake2b, initialAssignment, entropy);
  const coreAssignment = rotate(shuffledAssignment, shift, spec.coresCount);

  // we are sure this is PerValidator, since that's the array we create earlier.
  return asKnownSize(coreAssignment);
}

/** https://graypaper.fluffylabs.dev/#/ab2cdbd/148002148002?v=0.7.2 */
function rotate(cores: CoreIndex[], n: number, noOfCores: number) {
  // modulo `noOfCores` guarantees that we're within `CoreIndex` range.
  return cores.map((x) => asOpaqueType((x + n) % noOfCores));
}
