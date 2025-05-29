import type { State } from "@typeberry/state";

export type DisputesState = Pick<
  State,
  "disputesRecords" | "availabilityAssignment" | "timeslot" | "currentValidatorData" | "previousValidatorData"
>;
export type DisputesStateUpdate = Pick<DisputesState, "disputesRecords" | "availabilityAssignment">;
