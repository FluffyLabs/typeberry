import type { GuaranteesExtrinsicView } from "@typeberry/block/guarantees.js";
import { sumU64 } from "@typeberry/numbers";
import type { State, StateView } from "@typeberry/state";
import { OK, Result } from "@typeberry/utils";
import { ReportsError } from "./error.js";

/** `G_A`: The gas allocated to invoke a work-report’s Accumulation logic. */
export const G_A = 10_000_000;

export function verifyPostSignatureChecks(
  input: GuaranteesExtrinsicView,
  availabilityAssignment: State["availabilityAssignment"],
  authPools: ReturnType<StateView["authPoolsView"]>,
  services: State["getService"],
): Result<OK, ReportsError> {
  for (const guaranteeView of input) {
    const guarantee = guaranteeView.materialize();
    const report = guarantee.report;
    const coreIndex = report.coreIndex;
    /**
     * No reports may be placed on cores with a report pending
     * availability on it.
     *
     * https://graypaper.fluffylabs.dev/#/5f542d7/15ea0015ea00
     */
    if (availabilityAssignment[coreIndex] !== null) {
      return Result.error(ReportsError.CoreEngaged, () => `Report pending availability at core: ${coreIndex}`);
    }

    /**
     * A report is valid only if the authorizer hash is present
     * in the authorizer pool of the core on which the work is
     * reported.
     *
     * https://graypaper.fluffylabs.dev/#/5f542d7/15eb0015ed00
     */
    const authorizerHash = report.authorizerHash;
    const authorizerPool = authPools.get(coreIndex);
    const pool = authorizerPool?.materialize() ?? [];
    if (pool.find((hash) => hash.isEqualTo(authorizerHash)) === undefined) {
      return Result.error(
        ReportsError.CoreUnauthorized,
        () => `Authorizer hash not found in the pool of core ${coreIndex}: ${authorizerHash}`,
      );
    }

    /**
     * We require that the gas allotted for accumulation of each
     * work item in each work-report respects its service’s
     * minimum gas requirements.
     *
     * https://graypaper.fluffylabs.dev/#/5f542d7/15f80015fa00
     */
    for (const result of report.results) {
      const service = services(result.serviceId);
      if (service === null) {
        return Result.error(ReportsError.BadServiceId, () => `No service with id: ${result.serviceId}`);
      }
      const info = service.getInfo();

      // check minimal accumulation gas
      if (result.gas < info.accumulateMinGas) {
        return Result.error(
          ReportsError.ServiceItemGasTooLow,
          () =>
            `Service (${result.serviceId}) gas is less than minimal. Got: ${result.gas}, expected at least: ${info.accumulateMinGas}`,
        );
      }
    }

    const totalGas = sumU64(...report.results.map((x) => x.gas));
    if (totalGas.overflow || totalGas.value > G_A) {
      return Result.error(
        ReportsError.WorkReportGasTooHigh,
        () => `Total gas too high. Got: ${totalGas.value} (ovfl: ${totalGas.overflow}), maximal: ${G_A}`,
      );
    }
  }

  return Result.ok(OK);
}
