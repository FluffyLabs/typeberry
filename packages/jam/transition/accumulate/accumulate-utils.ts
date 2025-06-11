import { type EntropyHash, type ServiceId, type TimeSlot, tryAsServiceId } from "@typeberry/block";
import type { WorkPackageHash, WorkReport } from "@typeberry/block/work-report.js";
import { Encoder, codec } from "@typeberry/codec";
import { HashSet } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import { HASH_SIZE, blake2b } from "@typeberry/hash";
import { leBytesAsU32 } from "@typeberry/numbers";

/**
 * A function that removes duplicates but does not change order - it keeps the first occurence.
 */
export function uniquePreserveOrder<T extends number>(arr: T[]): T[] {
  const set = new Set<T>();

  for (const item of arr) {
    set.add(item);
  }

  return Array.from(set);
}

/**
 * A function that returns work package hashes for given work reports
 *
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/160102160102?v=0.6.7
 */
export function getWorkPackageHashes(reports: WorkReport[]): HashSet<WorkPackageHash> {
  const workPackageHashes = reports.map((report) => report.workPackageSpec.hash);
  return HashSet.from(workPackageHashes);
}

type NextServiceIdInput = {
  /** currently accumulated service */
  serviceId: ServiceId;
  /** `eta_0'` */
  entropy: EntropyHash;
  /** `H_t`: time slot of the header. */
  timeslot: TimeSlot;
};

const NEXT_ID_CODEC = codec.object({
  serviceId: codec.u32.asOpaque<ServiceId>(),
  entropy: codec.bytes(HASH_SIZE).asOpaque<EntropyHash>(),
  timeslot: codec.u32.asOpaque<TimeSlot>(),
});

/**
 * Generate a next service id.
 *
 * Please not that it does not call `check` function!
 *
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/2f4c022f4c02?v=0.6.7
 */
export function generateNextServiceId(
  { serviceId, entropy, timeslot }: NextServiceIdInput,
  chainSpec: ChainSpec,
): ServiceId {
  const encoded = Encoder.encodeObject(
    NEXT_ID_CODEC,
    {
      serviceId,
      entropy,
      timeslot,
    },
    chainSpec,
  );

  const result = blake2b.hashBytes(encoded).raw.subarray(0, 4);
  const number = leBytesAsU32(result) >>> 0;
  return tryAsServiceId((number % (2 ** 32 - 2 ** 9)) + 2 ** 8);
}
