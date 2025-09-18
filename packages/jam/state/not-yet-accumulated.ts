import { codecKnownSizeArray } from "@typeberry/block/codec.js";
import { MAX_REPORT_DEPENDENCIES } from "@typeberry/block/gp-constants.js";
import type { WorkPackageHash } from "@typeberry/block/refine-context.js";
import { WorkReport } from "@typeberry/block/work-report.js";
import { type CodecRecord, codec } from "@typeberry/codec";
import type { KnownSizeArray } from "@typeberry/collections";
import { HASH_SIZE } from "@typeberry/hash";
import { WithDebug } from "@typeberry/utils";

/**
 * Ready (i.e. available and/or audited) but not-yet-accumulated work-reports.
 *
 * https://graypaper.fluffylabs.dev/#/5f542d7/165300165400
 */
export class NotYetAccumulatedReport extends WithDebug {
  static Codec = codec.Class(NotYetAccumulatedReport, {
    report: WorkReport.Codec,
    dependencies: codecKnownSizeArray(codec.bytes(HASH_SIZE).asOpaque<WorkPackageHash>(), {
      typicalLength: MAX_REPORT_DEPENDENCIES / 2,
      maxLength: MAX_REPORT_DEPENDENCIES,
      minLength: 0,
    }),
  });

  static create({ report, dependencies }: CodecRecord<NotYetAccumulatedReport>) {
    return new NotYetAccumulatedReport(report, dependencies);
  }

  private constructor(
    /**
     * Each of these were made available at most one epoch ago
     * but have or had unfulfilled dependencies.
     */
    readonly report: WorkReport,
    /**
     * Alongside the work-report itself, we retain its un-accumulated
     * dependencies, a set of work-package hashes.
     *
     * https://graypaper.fluffylabs.dev/#/5f542d7/165800165800
     */
    readonly dependencies: KnownSizeArray<WorkPackageHash, `[0..${MAX_REPORT_DEPENDENCIES})`>,
  ) {
    super();
  }
}
