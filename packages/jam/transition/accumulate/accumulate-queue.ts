import type { TimeSlot } from "@typeberry/block";
import type { WorkPackageHash, WorkReport } from "@typeberry/block/work-report";
import type { ChainSpec } from "@typeberry/config";
import type { AccumulateState } from "../accumulate";
import { getWorkPackageHashes } from "./accumulate-utils";

export type QueueItem = {
  report: WorkReport;
  dependencies: WorkPackageHash[];
};

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

  getWorkReportsToAccumulateLater(reports: WorkReport[]): QueueItem[] {
    const history = this.state.accumulated.flat();
    const reportsWithDependencies = reports.filter(
      (report) => report.context.prerequisites.length > 0 || report.segmentRootLookup.length > 0,
    );

    const itemsToEnqueue = reportsWithDependencies.map<QueueItem>((report) => ({
      report,
      dependencies: this.getWorkReportDependencies(report),
    }));

    return pruneQueue(itemsToEnqueue, history);
  }

  enqueueReports(r: QueueItem[]): WorkReport[] {
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
    const fromPhaseIndexToEnd = this.state.readyQueue.slice(phaseIndex);
    const fromStartToPhaseIndex = this.state.readyQueue.slice(0, phaseIndex);
    return fromPhaseIndexToEnd.concat(fromStartToPhaseIndex).flat();
  }
}

export function pruneQueue(reports: QueueItem[], processedHashes: WorkPackageHash[]) {
  return reports
    .filter(({ report }) => processedHashes.find((hash) => hash.isEqualTo(report.workPackageSpec.hash)) === undefined)
    .map((item) => {
      const { report, dependencies } = item;
      return {
        report,
        dependencies: dependencies.filter(
          (dependency) => processedHashes.find((historyItem) => historyItem.isEqualTo(dependency)) === undefined,
        ),
      };
    });
}
