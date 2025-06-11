import type { GuaranteesExtrinsicView } from "@typeberry/block/guarantees.js";
import type { ChainSpec } from "@typeberry/config";
import { OK, Result } from "@typeberry/utils";
import { ReportsError } from "./error.js";

export function verifyReportsOrder(input: GuaranteesExtrinsicView, chainSpec: ChainSpec): Result<OK, ReportsError> {
  /**
   * The core index of each guarantee must be unique and
   * guarantees must be in ascending order of this.
   *
   * https://graypaper.fluffylabs.dev/#/5f542d7/146902146a02
   */
  const noOfCores = chainSpec.coresCount;
  let lastCoreIndex = -1;
  for (const guarantee of input) {
    const reportView = guarantee.view().report.view();
    const coreIndex = reportView.coreIndex.materialize();
    if (lastCoreIndex >= coreIndex) {
      return Result.error(
        ReportsError.OutOfOrderGuarantee,
        `Core indices of work reports are not unique or in order. Got: ${coreIndex}, expected at least: ${lastCoreIndex + 1}`,
      );
    }
    if (coreIndex >= noOfCores) {
      return Result.error(ReportsError.BadCoreIndex, `Invalid core index. Got: ${coreIndex}, max: ${noOfCores}`);
    }
    lastCoreIndex = coreIndex;
  }

  return Result.ok(OK);
}
