import type { TimeSlot } from "@typeberry/block";
import type { WorkPackageHash, WorkReport } from "@typeberry/block/work-report";
import { HashSet, asKnownSize } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import { NotYetAccumulatedReport } from "@typeberry/state/not-yet-accumulated";
import type { AccumulateState } from "../accumulate";
import { getWorkPackageHashes } from "./accumulate-utils";

export class AccumulateQueue {
  constructor(
    public readonly state: AccumulateState,
    public readonly chainSpec: ChainSpec,
  ) {}

  getWorkReportsToAccumulateImmediately(reports: WorkReport[]): WorkReport[] {
    return reports.filter((report) => {
      return report.context.prerequisites.length === 0 && report.segmentRootLookup.length === 0;
    });
  }

  private getWorkReportDependencies(report: WorkReport): WorkPackageHash[] {
    return report.context.prerequisites.concat(report.segmentRootLookup.map((x) => x.workPackageHash));
  }

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

  getQueueFromState(slot: TimeSlot) {
    const phaseIndex = slot % this.chainSpec.epochLength;
    const fromPhaseIndexToEnd = this.state.accumulationQueue.slice(phaseIndex);
    const fromStartToPhaseIndex = this.state.accumulationQueue.slice(0, phaseIndex);
    return fromPhaseIndexToEnd.concat(fromStartToPhaseIndex).flat();
  }
}

export function pruneQueue(reports: NotYetAccumulatedReport[], processedHashes: HashSet<WorkPackageHash>) {
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
