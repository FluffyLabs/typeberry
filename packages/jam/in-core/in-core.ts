import type { CoreIndex, Segment } from "@typeberry/block";
import { type RefineContext, type WorkPackageHash, WorkPackageInfo } from "@typeberry/block/refine-context.js";
import type { WorkItemExtrinsic } from "@typeberry/block/work-item.js";
import type { WorkPackage } from "@typeberry/block/work-package.js";
import { WorkPackageSpec, WorkReport } from "@typeberry/block/work-report.js";
import { Bytes } from "@typeberry/bytes";
import { asKnownSize, FixedSizeArray } from "@typeberry/collections";
import type { ChainSpec, PvmBackend } from "@typeberry/config";
import type { StatesDb } from "@typeberry/database";
import type { Blake2b, WithHash } from "@typeberry/hash";
import { HASH_SIZE } from "@typeberry/hash";
import { Logger } from "@typeberry/logger";
import { tryAsU8, tryAsU16, tryAsU32 } from "@typeberry/numbers";
import { buildWorkPackageFetchData } from "@typeberry/transition/externalities/fetch-externalities.js";
import { assertEmpty, Result } from "@typeberry/utils";
import { AuthorizationError, type AuthorizationOk, IsAuthorized } from "./is-authorized.js";
import { type ImportedSegment, type PerWorkItem, Refine, type RefineItemResult } from "./refine.js";

export type { ImportedSegment, PerWorkItem, RefineItemResult } from "./refine.js";

export type RefineResult = {
  report: WorkReport;
  exports: PerWorkItem<Segment[]>;
};

export enum RefineError {
  /** State for context anchor block or lookup anchor is not found in the DB. */
  StateMissing = 0,
  /** Posterior state root of context anchor block does not match the one in the DB. */
  StateRootMismatch = 1,
  /** Lookup anchor state-slot does not match the one given in context. */
  InvalidLookupAnchorSlot = 2,
  /** Authorization error. */
  AuthorizationError = 3,
}

const logger = Logger.new(import.meta.filename, "refine");

export class InCore {
  private readonly isAuthorized: IsAuthorized;
  private readonly refineItem: Refine;

  constructor(
    public readonly chainSpec: ChainSpec,
    private readonly states: StatesDb,
    pvmBackend: PvmBackend,
    blake2b: Blake2b,
  ) {
    this.isAuthorized = new IsAuthorized(chainSpec, pvmBackend, blake2b);
    this.refineItem = new Refine(chainSpec, pvmBackend, blake2b);
  }

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
    workPackageAndHash: WithHash<WorkPackageHash, WorkPackage>,
    core: CoreIndex,
    imports: PerWorkItem<ImportedSegment[]>,
    extrinsics: PerWorkItem<WorkItemExtrinsic[]>,
  ): Promise<Result<RefineResult, RefineError>> {
    const workPackageHash = workPackageAndHash.hash;
    const { context, items } = workPackageAndHash.data;

    // TODO [ToDr] Verify BEEFY root
    // TODO [ToDr] Verify prerequisites
    logger.log`[core:${core}] Attempting to refine work package with ${items.length} items.`;

    // Verify anchor block
    // https://graypaper.fluffylabs.dev/#/ab2cdbd/15cd0215cd02?v=0.7.2
    // TODO [ToDr] Validation
    const state = this.states.getState(context.anchor);
    if (state === null) {
      return Result.error(RefineError.StateMissing, () => `State at anchor block ${context.anchor} is missing.`);
    }

    const stateRoot = await this.states.getStateRoot(state);
    if (!stateRoot.isEqualTo(context.stateRoot)) {
      return Result.error(
        RefineError.StateRootMismatch,
        () =>
          `State at ${context.anchor} does not match expected root hash. Ours: ${stateRoot}, expected: ${context.stateRoot}`,
      );
    }

    // TODO [ToDr] GP link
    // Verify lookup anchor state
    const lookupState = this.states.getState(context.lookupAnchor);
    if (lookupState === null) {
      return Result.error(RefineError.StateMissing, () => `Lookup state at block ${context.lookupAnchor} is missing.`);
    }

    // TODO [ToDr] GP link
    if (lookupState.timeslot !== context.lookupAnchorSlot) {
      return Result.error(
        RefineError.InvalidLookupAnchorSlot,
        () =>
          `Lookup anchor slot does not match the one is state. Ours: ${lookupState.timeslot}, expected: ${context.lookupAnchorSlot}`,
      );
    }

    // Eagerly build the per-package fetch data so we pay the encoding cost
    const packageFetchData = buildWorkPackageFetchData(this.chainSpec, workPackageAndHash.data);

    // Check authorization
    const authResult = await this.isAuthorized.invoke(state, core, workPackageAndHash.data, packageFetchData);
    if (authResult.isError) {
      return Result.error(
        RefineError.AuthorizationError,
        () => `Authorization error: ${AuthorizationError[authResult.error]}: ${authResult.details()}.`,
      );
    }

    logger.log`[core:${core}] Authorized. Proceeding with work items verification. Anchor=${context.anchor}`;

    // Verify the work items
    let exportOffset = 0;
    const refineResults: RefineItemResult[] = [];
    for (const [idx, item] of items.entries()) {
      logger.info`[core:${core}][i:${idx}] Refining item for service ${item.service}.`;

      const result = await this.refineItem.invoke(
        state,
        lookupState,
        packageFetchData,
        idx,
        item,
        imports,
        extrinsics,
        core,
        workPackageHash,
        exportOffset,
        authResult.ok.authorizationOutput,
      );
      refineResults.push(result);
      exportOffset += result.exports.length;
    }

    // amalgamate the work report now
    return Result.ok(
      InCore.amalgamateWorkReport(asKnownSize(refineResults), authResult.ok, workPackageHash, context, core),
    );
  }

  private static amalgamateWorkReport(
    refineResults: PerWorkItem<RefineItemResult>,
    authResult: AuthorizationOk,
    workPackageHash: WorkPackageHash,
    context: RefineContext,
    coreIndex: CoreIndex,
  ) {
    // unzip exports and work results for each work item
    const exports = refineResults.map((x) => x.exports);
    const results = refineResults.map((x) => x.result);

    const { authorizerHash, authorizationGasUsed, authorizationOutput, ...authRest } = authResult;
    assertEmpty(authRest);

    // TODO [ToDr] Compute erasure root
    const erasureRoot = Bytes.zero(HASH_SIZE);
    // TODO [ToDr] Compute exports root
    const exportsRoot = Bytes.zero(HASH_SIZE).asOpaque();
    const exportsCount = exports.reduce((acc, x) => acc + x.length, 0);

    // TODO [ToDr] Segment root lookup computation?
    const segmentRootLookup = [
      WorkPackageInfo.create({
        workPackageHash,
        segmentTreeRoot: exportsRoot,
      }),
    ];

    // TODO [ToDr] Auditable work bundle length?
    const workBundleLength = tryAsU32(0);

    return {
      report: WorkReport.create({
        workPackageSpec: WorkPackageSpec.create({
          length: workBundleLength,
          hash: workPackageHash,
          erasureRoot,
          exportsRoot,
          // safe to convert, since we have limit on number of
          // exports per item and a limit for number of items
          exportsCount: tryAsU16(exportsCount),
        }),
        context,
        coreIndex,
        authorizerHash,
        authorizationGasUsed,
        authorizationOutput,
        segmentRootLookup,
        // safe to convert, since we know that number of work items is limited
        results: FixedSizeArray.new(results, tryAsU8(refineResults.length)),
      }),
      exports: asKnownSize(exports),
    };
  }
}
