import type { CoreIndex, Segment, SegmentIndex } from "@typeberry/block";
import type { WorkItemExtrinsic } from "@typeberry/block/work-item.js";
import type { WorkPackage } from "@typeberry/block/work-package.js";
import type { WorkReport } from "@typeberry/block/work-report.js";
import type { KnownSizeArray } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import type { Result } from "@typeberry/utils";

export type RefineResult = {
  report: WorkReport;
  exports: PerWorkItem<Segment[]>;
};

export enum RefineError {}

export type PerWorkItem<T> = KnownSizeArray<T, "for each work item">;

export type ImportedSegment = {
  index: SegmentIndex;
  data: Segment;
};

export class Refine {
  constructor(
    public readonly chainSpec: ChainSpec,
    // TODO: blocks, state?
  ) {}

  /**
   * Work-report computation function.
   *
   * Note this requires all of the imports and extrinsics to be already fetched
   * and only performs the refinement.
   *
   * Any validation must be done externally!
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/1b7f021b7f02?v=0.7.2
   */
  refine(
    workPackage: WorkPackage,
    core: CoreIndex,
    imports: PerWorkItem<ImportedSegment>,
    extrinsics: PerWorkItem<WorkItemExtrinsic[]>,
  ): Result<RefineResult, RefineError> {
    throw new Error("todo");
  }
}
