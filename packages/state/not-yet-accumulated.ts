import { type WorkPackageHash, WorkReport } from "@typeberry/block/work-report";
import { type CodecRecord, codec } from "@typeberry/codec";
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
    unlocks: codec.sequenceVarLen(codec.bytes(HASH_SIZE).asOpaque()),
  });

  static fromCodec({ report, unlocks }: CodecRecord<NotYetAccumulatedReport>) {
    return new NotYetAccumulatedReport(report, unlocks);
  }

  constructor(
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
    readonly unlocks: WorkPackageHash[],
  ) {
    super();
  }
}
