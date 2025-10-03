import type { TimeSlot } from "@typeberry/block";
import { WorkReport } from "@typeberry/block/work-report.js";
import { type CodecRecord, codec } from "@typeberry/codec";
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
  static Codec = codec.Class(AvailabilityAssignment, {
    workReport: WorkReport.Codec,
    timeout: codec.u32.asOpaque<TimeSlot>(),
  });

  static create({ workReport, timeout }: CodecRecord<AvailabilityAssignment>) {
    return new AvailabilityAssignment(workReport, timeout);
  }

  private constructor(
    /** Work report assigned to a core. */
    public readonly workReport: WorkReport,
    /** Time slot at which the report becomes obsolete. */
    public readonly timeout: TimeSlot,
  ) {
    super();
  }
}
