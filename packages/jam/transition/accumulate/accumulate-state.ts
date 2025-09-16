import type { EntropyHash, ServiceId, TimeSlot } from "@typeberry/block";
import type { WorkReport } from "@typeberry/block/work-report.js";
import type { OpaqueHash } from "@typeberry/hash";
import type { PendingTransfer, ServiceStateUpdate } from "@typeberry/jam-host-calls";
import type { AccumulationOutput, State } from "@typeberry/state";
import type { CountAndGasUsed } from "../statistics.js";

/** `G_A`: The gas allocated to invoke a work-report’s Accumulation logic. */
export const GAS_TO_INVOKE_WORK_REPORT = 10_000_000n;

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
  | "timeslot"
  | "designatedValidatorData"
  | "authQueues"
  | "getService"
  | "recentlyAccumulated"
  | "accumulationQueue"
  | "privilegedServices"
>;

/** Aggregated update of the accumulation state transition. */
export type AccumulateStateUpdate = Pick<State, "timeslot"> &
  Partial<Pick<State, "recentlyAccumulated" | "accumulationQueue">> &
  ServiceStateUpdate;

export type AccumulateResult = {
  stateUpdate: AccumulateStateUpdate;
  accumulationStatistics: Map<ServiceId, CountAndGasUsed>;
  pendingTransfers: PendingTransfer[];
  accumulationOutputLog: AccumulationOutput[];
};
