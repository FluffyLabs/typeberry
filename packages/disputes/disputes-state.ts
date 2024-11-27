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

// TODO [MaSi]: add docs and gp references
export class DisputesRecords {
  constructor(
    public readonly goodSet: SortedSet<WorkReportHash>,
    public readonly badSet: SortedSet<WorkReportHash>,
    public readonly wonkySet: SortedSet<WorkReportHash>,
    public readonly punishSet: SortedSet<Ed25519Key>,
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
