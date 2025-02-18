import type { State } from "@typeberry/state";

export type DisputesState = {
  readonly disputesRecords: State["disputesRecords"];
  readonly availabilityAssignment: State["availabilityAssignment"];
  readonly timeslot: State["timeslot"];
  readonly currentValidatorData: State["currentValidatorData"];
  readonly previousValidatorData: State["previousValidatorData"];
};
