import type { State } from "@typeberry/state";

export type DisputesState = Pick<
  State,
  "disputesRecords" | "availabilityAssignment" | "timeslot" | "currentValidatorData" | "previousValidatorData"
>;
