import { MAX_REPORT_DEPENDENCIES } from "@typeberry/block/gp-constants.js";
import type { GuaranteesExtrinsicView } from "@typeberry/block/guarantees.js";
import { WorkExecResultKind } from "@typeberry/block/work-result.js";
import { OK, Result } from "@typeberry/utils";
import { ReportsError } from "./error.js";

/**
 * `W_R = 48 * 2**10`: The maximum total size of all output blobs in a work-report, in octets.
 *
 * https://graypaper.fluffylabs.dev/#/5f542d7/41a60041aa00?v=0.6.2
 */
export const MAX_WORK_REPORT_SIZE_BYTES = 48 * 2 ** 10;

export function verifyReportsBasic(input: GuaranteesExtrinsicView): Result<OK, ReportsError> {
  for (const guarantee of input) {
    const reportView = guarantee.view().report.view();
    /**
     * We limit the sum of the number of items in the
     * segment-root lookup dictionary and the number of
     * prerequisites to J = 8:
     *
     * https://graypaper.fluffylabs.dev/#/5f542d7/13ab0013ad00?v=0.6.2
     */
    const noOfPrerequisites = reportView.context.view().prerequisites.view().length;
    const noOfSegmentRootLookups = reportView.segmentRootLookup.view().length;
    if (noOfPrerequisites + noOfSegmentRootLookups > MAX_REPORT_DEPENDENCIES) {
      return Result.error(
        ReportsError.TooManyDependencies,
        () =>
          `Report at ${reportView.coreIndex.materialize()} has too many dependencies. Got ${noOfPrerequisites} + ${noOfSegmentRootLookups}, max: ${MAX_REPORT_DEPENDENCIES}`,
      );
    }

    /**
     * In order to ensure fair use of a block’s extrinsic space,
     * work-reports are limited in the maximum total size of the
     * successful output blobs together with the authorizer output
     * blob, effectively limiting their overall size:
     *
     * https://graypaper.fluffylabs.dev/#/5f542d7/141d00142000?v=0.6.2
     */
    // adding is safe here, since the total-encoded size of the report
    // is limited as well. Even though we just have a view, the size
    // should have been verified earlier.
    const authOutputSize = reportView.authorizationOutput.view().length;
    let totalOutputsSize = 0;
    for (const item of reportView.results.view()) {
      const workItemView = item.view();
      const result = workItemView.result.materialize();
      if (result.kind === WorkExecResultKind.ok) {
        totalOutputsSize += result.okBlob?.raw.length ?? 0;
      }
    }
    if (authOutputSize + totalOutputsSize > MAX_WORK_REPORT_SIZE_BYTES) {
      return Result.error(
        ReportsError.WorkReportTooBig,
        () =>
          `Work report at ${reportView.coreIndex.materialize()} too big. Got ${authOutputSize} + ${totalOutputsSize}, max: ${MAX_WORK_REPORT_SIZE_BYTES}`,
      );
    }
  }

  return Result.ok(OK);
}
