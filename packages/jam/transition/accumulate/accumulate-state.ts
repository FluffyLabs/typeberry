import type { EntropyHash, ServiceId, TimeSlot } from "@typeberry/block";
import type { WorkReport } from "@typeberry/block/work-report.js";
import type { OpaqueHash } from "@typeberry/hash";
import type { PendingTransfer, ServiceStateUpdate } from "@typeberry/jam-host-calls";
import type { AccumulationOutput, State } from "@typeberry/state";
import type { CountAndGasUsed } from "../statistics.js";

export type AccumulateRoot = OpaqueHash;

export type AccumulateInput = {
  /** time slot from header */
  slot: TimeSlot;
  /** List of newly available work-reports */
  reports: WorkReport[];
  /** eta0' (after Safrole STF) - it is not eta0 from state! */
  entropy: EntropyHash;
};

export type AccumulateState = Pick<
  State,
  | "designatedValidatorData"
  | "timeslot"
  | "authQueues"
  | "getService"
  | "recentlyAccumulated"
  | "accumulationQueue"
  | "privilegedServices"
>;

/** Aggregated update of the accumulation state transition. */
export type AccumulateStateUpdate = Pick<
  State,
  /* TODO [ToDr] seems that we are doing the same stuff as safrole? */
  "timeslot"
> &
  Partial<Pick<State, "recentlyAccumulated" | "accumulationQueue">> &
  ServiceStateUpdate;

export type AccumulateResult = {
  root: AccumulateRoot;
  stateUpdate: AccumulateStateUpdate;
  accumulationStatistics: Map<ServiceId, CountAndGasUsed>;
  pendingTransfers: PendingTransfer[];
  accumulationOutputLog: AccumulationOutput[];
};
