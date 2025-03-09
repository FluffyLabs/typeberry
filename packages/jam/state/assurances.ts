import type { TimeSlot, WorkReportHash } from "@typeberry/block";
import type { WorkReport } from "@typeberry/block/work-report";
import type { WithHash } from "@typeberry/hash";
import { WithDebug } from "@typeberry/utils";

/**
 * Assignment of particular work report to a core.
 *
 * Used by "Assurances" and "Disputes" subsystem, denoted by `rho`
 * in state.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/135800135800
 */
export class AvailabilityAssignment extends WithDebug {
  constructor(
    /** Work report assigned to a core. */
    public readonly workReport: WithHash<WorkReportHash, WorkReport>,
    /** Time slot at which the report becomes obsolete. */
    public readonly timeout: TimeSlot,
  ) {
    super();
  }
}
