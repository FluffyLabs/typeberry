import type { Ed25519Key, TimeSlot, WorkReportHash } from "@typeberry/block";
import type { Bytes } from "@typeberry/bytes";
import { Ordering, SortedSet } from "@typeberry/collections";
import type { ValidatorData } from "@typeberry/safrole";

function hashComparator<V extends WorkReportHash | Ed25519Key>(a: V, b: V) {
  if (a.isLessThan(b)) {
    return Ordering.Less;
  }

  if (a.isEqualTo(b)) {
    return Ordering.Equal;
  }

  return Ordering.Greater;
}
export class DisputesRecords {
  constructor(
    public goodSet: SortedSet<WorkReportHash>,
    public badSet: SortedSet<WorkReportHash>,
    public wonkySet: SortedSet<WorkReportHash>,
    public punishSet: SortedSet<Ed25519Key>,
  ) {}

  static tryToCreateFromArrays(
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
    public workReport: Bytes<354>,
    public timeout: number,
  ) {}
}

export class DisputesState {
  constructor(
    public disputesRecords: DisputesRecords,
    public availabilityAssignment: Array<AvailabilityAssignment | undefined>,
    public timeslot: TimeSlot,
    public currentValidatorData: ValidatorData[],
    public previousValidatorData: ValidatorData[],
  ) {}
}
