import type { Ed25519Key, TimeSlot, WorkReportHash } from "@typeberry/block";
import type { Bytes } from "@typeberry/bytes";
import type { ValidatorData } from "@typeberry/safrole";

export class DisputesRecords {
  constructor(
    public goodSet: WorkReportHash[],
    public badSet: WorkReportHash[],
    public wonkySet: WorkReportHash[],
    public punishSet: Ed25519Key[],
  ) {}
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
