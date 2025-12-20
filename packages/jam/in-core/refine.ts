import type { CoreIndex, Segment, SegmentIndex } from "@typeberry/block";
import type { WorkItemExtrinsic } from "@typeberry/block/work-item.js";
import type { WorkPackage } from "@typeberry/block/work-package.js";
import type { WorkReport } from "@typeberry/block/work-report.js";
import type { KnownSizeArray } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import {StatesDb} from "@typeberry/database";
import {PvmExecutor} from "@typeberry/executor";
import {Logger} from "@typeberry/logger";
import {State} from "@typeberry/state";
import { Result } from "@typeberry/utils";

export type RefineResult = {
  report: WorkReport;
  exports: PerWorkItem<Segment[]>;
};

export enum RefineError {
  /** State for context anchor block or lookup anchor is not found in the DB. */
  StateMissing,
  /** Posterior state root of context anchor block does not match the one in the DB. */
  StateRootMismatch,
  /** Service id is not found in the state. */
  ServiceNotFound,
  /** Expected service code does not match the state one. */
  ServiceCodeMismatch,
  /** Lookup anchor state-slot does not match the one given in context. */
  InvalidLookupAnchorSlot,
}

export type PerWorkItem<T> = KnownSizeArray<T, "for each work item">;

export type ImportedSegment = {
  index: SegmentIndex;
  data: Segment;
};

export type RefineState = Pick<
  State,
  | "getService",
>;

const logger = Logger.new(import.meta.filename, "refine");

export class Refine {
  constructor(
    public readonly chainSpec: ChainSpec,
    private readonly states: StatesDb,
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
  async refine(
    workPackage: WorkPackage,
    core: CoreIndex,
    imports: PerWorkItem<ImportedSegment>,
    extrinsics: PerWorkItem<WorkItemExtrinsic[]>,
  ): Promise<Result<RefineResult, RefineError>> {
    const context = workPackage.context;
    // TODO [ToDr] Verify BEEFY when we have it
    // TODO [ToDr] Verify prerequisites
    logger.log`[core:${core}] Attempting to refine work package with ${workPackage.items.length} items.`;

    // TODO [ToDr] GP link
    // Verify anchor block
    const state = this.states.getState(context.anchor);
    if (state === null) {
      return Result.error(
        RefineError.StateMissing,
        () => `State at anchor block ${context.anchor} is missing.`
      );
    }

    const stateRoot = await this.states.getStateRoot(state);
    if (stateRoot.isEqualTo(context.stateRoot)) {
      return Result.error(
        RefineError.StateRootMismatch,
        () => `State at ${context.anchor} does not match expected root hash. Ours: ${stateRoot}, expected: ${context.stateRoot}`
      );
    }

    // TODO [ToDr] GP link
    // Verify lookup anchor state
    const lookupState = this.states.getState(context.lookupAnchor);
    if (lookupState === null) {
      return Result.error(
        RefineError.StateMissing,
        () => `Lookup state at block ${context.lookupAnchor} is missing.`
      );
    }

    // TODO [ToDr] GP link
    if (lookupState.timeslot !== context.lookupAnchorSlot) {
      return Result.error(
        RefineError.InvalidLookupAnchorSlot,
        () => `Lookup anchor slot does not match the one is state. Ours: ${lookupState.timeslot}, expected: ${context.lookupAnchorSlot}`
      );
    }

    // TODO [ToDr] Check authorization?

    logger.log`[core:${core}] Proceeding with work items verification. Anchor=${context.anchor}`;

    // Verify the work items
    for (const item of workPackage.items) {
      const serviceId = item.service;
      const service = state.getService(serviceId);

      // TODO [ToDr] GP link
      // missing service
      if (service === null) {
        return Result.error(
          RefineError.ServiceNotFound,
          () => `Service ${serviceId} is missing in state.`
        );
      }

      // TODO [ToDr] GP link
      // TODO [ToDr] shall we rather use the old codehash instead
      if (service.getInfo().codeHash.isEqualTo(item.codeHash)) {
        return Result.error(
          RefineError.ServiceCodeMismatch,
          () => `Service ${serviceId} has invalid code hash. Ours: ${service.getInfo().codeHash}, expected: ${item.codeHash}`
        );
      }

      const code = service.getPreimage(item.codeHash.asOpaque());
    }


    // PvmExecutor.createRefineExecutor(
    throw new Error("todo");
  }
}
