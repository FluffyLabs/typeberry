import type { TimeSlot } from "@typeberry/block";
import type { WorkPackageHash } from "@typeberry/block/refine-context.js";
import type { WorkReport } from "@typeberry/block/work-report.js";
import { asKnownSize, HashSet } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import { NotYetAccumulatedReport } from "@typeberry/state";
import type { AccumulateState } from "./accumulate-state.js";
import { getWorkPackageHashes } from "./accumulate-utils.js";

export class AccumulateQueue {
  constructor(
    public readonly chainSpec: ChainSpec,
    public readonly state: AccumulateState,
  ) {}

  /**
   * Returns work reports that do not have any deps and can be accumulate immediately
   *
   * https://graypaper.fluffylabs.dev/#/7e6ff6a/16fa0016fa00?v=0.6.7
   */
  getWorkReportsToAccumulateImmediately(reports: WorkReport[]): WorkReport[] {
    return reports.filter((report) => {
      return report.context.prerequisites.length === 0 && report.segmentRootLookup.length === 0;
    });
  }

  /**
   * Returns work report dependencies
   *
   * https://graypaper.fluffylabs.dev/#/7e6ff6a/162a01162a01?v=0.6.7
   */
  private getWorkReportDependencies(report: WorkReport): WorkPackageHash[] {
    return Array.from(
      HashSet.from(report.context.prerequisites.concat(report.segmentRootLookup.map((x) => x.workPackageHash))),
    );
  }

  /**
   * Returns work reports that have some dependencies and cannot be accumulate immediately
   *
   * https://graypaper.fluffylabs.dev/#/7e6ff6a/162301162301?v=0.6.7
   */
  getWorkReportsToAccumulateLater(reports: WorkReport[]): NotYetAccumulatedReport[] {
    const history = this.state.recentlyAccumulated.flatMap((set) => Array.from(set));
    const reportsWithDependencies = reports.filter(
      (report) => report.context.prerequisites.length > 0 || report.segmentRootLookup.length > 0,
    );

    const itemsToEnqueue = reportsWithDependencies.map<NotYetAccumulatedReport>((report) =>
      NotYetAccumulatedReport.create({
        report,
        dependencies: asKnownSize(this.getWorkReportDependencies(report)),
      }),
    );

    return pruneQueue(itemsToEnqueue, HashSet.from(history));
  }

  /**
   * Reorders work reports based on their dependencies
   *
   * https://graypaper.fluffylabs.dev/#/7e6ff6a/16a40116a401?v=0.6.7
   */
  enqueueReports(r: NotYetAccumulatedReport[]): WorkReport[] {
    const result: WorkReport[] = [];

    let queue = [...r];

    while (queue.length > 0) {
      const ready = queue.filter(({ dependencies }) => dependencies.length === 0).map(({ report }) => report);

      if (ready.length === 0) {
        return result;
      }

      result.push(...ready);

      const readyHashes = getWorkPackageHashes(ready);

      queue = pruneQueue(queue, readyHashes);
    }

    return result;
  }

  /**
   * Returns work reports to accumulate from state
   *
   * https://graypaper.fluffylabs.dev/#/7e6ff6a/165d02165d02?v=0.6.7
   */
  getQueueFromState(slot: TimeSlot) {
    const phaseIndex = slot % this.chainSpec.epochLength;
    const fromPhaseIndexToEnd = this.state.accumulationQueue.slice(phaseIndex);
    const fromStartToPhaseIndex = this.state.accumulationQueue.slice(0, phaseIndex);
    return fromPhaseIndexToEnd.concat(fromStartToPhaseIndex).flat();
  }
}

/**
 * A fuction that removes all entries whose work-report’s hash is in the set provided as a parameter, and removes any dependencies which appear in said set.
 * It is defined as E function in GP:
 *
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/164501164501?v=0.6.7
 */
export function pruneQueue(reports: readonly NotYetAccumulatedReport[], processedHashes: HashSet<WorkPackageHash>) {
  return reports
    .filter(({ report }) => !processedHashes.has(report.workPackageSpec.hash))
    .map((item) => {
      const { report, dependencies } = item;
      return NotYetAccumulatedReport.create({
        report,
        dependencies: asKnownSize(dependencies.filter((dependency) => !processedHashes.has(dependency))),
      });
    });
}
