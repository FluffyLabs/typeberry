import type { WorkPackageHash, WorkReport } from "@typeberry/block/work-report";
import { HashSet } from "@typeberry/collections";

export function uniquePreserveOrder<T extends number>(arr: T[]): T[] {
  const set = new Set<T>();

  for (const item of arr) {
    set.add(item);
  }

  return Array.from(set);
}

export function getWorkPackageHashes(reports: WorkReport[]): HashSet<WorkPackageHash> {
  const workPackageHashes = reports.map((report) => report.workPackageSpec.hash);
  return HashSet.from(workPackageHashes);
}
