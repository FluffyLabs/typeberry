import type { WorkReport } from "@typeberry/block/work-report";
import { HashSet, SortedSet } from "@typeberry/collections";
import { hashComparator } from "@typeberry/state";

export function uniquePreserveOrder<T extends number>(arr: T[]): T[] {
  const seen = new Set<T>();
  return arr.filter((item) => {
    if (seen.has(item)) {
      return false;
    }
    seen.add(item);
    return true;
  });
}

export function getWorkPackageHashes(reports: WorkReport[]) {
  const workPackageHashes = reports.map((report) => report.workPackageSpec.hash);
  const uniqueHashes = HashSet.from(workPackageHashes);
  const uniqueSortedHashes = SortedSet.fromArray(hashComparator, Array.from(uniqueHashes));
  return uniqueSortedHashes.array;
}
