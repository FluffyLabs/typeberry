import type { Ed25519Key, TimeSlot, ValidatorData, WorkReportHash } from "@typeberry/block";
import type { WorkReport } from "@typeberry/block/work-report";
import type { BytesBlob } from "@typeberry/bytes";
import { Ordering, SortedSet } from "@typeberry/collections";

export function hashComparator<V extends WorkReportHash | Ed25519Key>(a: V, b: V) {
  if (a.isLessThan(b)) {
    return Ordering.Less;
  }

  if (b.isLessThan(a)) {
    return Ordering.Greater;
  }

  return Ordering.Equal;
}

/**
 * Disputes state that is consist of 4 items:
 * - goodSet - all work-reports hashes which were judged to be correct
 * - badSet - all work-reports hashes which were judged to be incorrect
 * - wonkySet - all work-reports hashes which appear to be impossible to judge
 * - punishSet - set of Ed25519 keys representing validators which were found to have misjudged a work-report
 *
 * https://graypaper.fluffylabs.dev/#/911af30/122b00124700
 */
export class DisputesRecords {
  constructor(
    public goodSet: SortedSet<WorkReportHash>,
    public badSet: SortedSet<WorkReportHash>,
    public wonkySet: SortedSet<WorkReportHash>,
    public punishSet: SortedSet<Ed25519Key>,
  ) {}

  static fromSortedArrays(
    goodSet: WorkReportHash[],
    badSet: WorkReportHash[],
    wonkySet: WorkReportHash[],
    punishSet: Ed25519Key[],
  ) {
    return new DisputesRecords(
      SortedSet.fromSortedArray(hashComparator, goodSet),
      SortedSet.fromSortedArray(hashComparator, badSet),
      SortedSet.fromSortedArray(hashComparator, wonkySet),
      SortedSet.fromSortedArray(hashComparator, punishSet),
    );
  }
}

export class AvailabilityAssignment {
  constructor(
    public workReport: WorkReport,
    public timeout: number,
    public workReportBytes: BytesBlob,
  ) {}
}

export class DisputesState {
  constructor(
    public readonly disputesRecords: DisputesRecords,
    public readonly availabilityAssignment: Array<AvailabilityAssignment | null>,
    public readonly timeslot: TimeSlot,
    public readonly currentValidatorData: ValidatorData[],
    public readonly previousValidatorData: ValidatorData[],
  ) {}
}
