import {
  type CoreIndex,
  type Segment,
  type SegmentIndex,
  type ServiceId,
  tryAsCoreIndex,
  tryAsServiceGas,
} from "@typeberry/block";
import { W_C } from "@typeberry/block/gp-constants.js";
import { type WorkPackageHash, WorkPackageInfo } from "@typeberry/block/refine-context.js";
import type { WorkItem, WorkItemExtrinsic } from "@typeberry/block/work-item.js";
import type { WorkPackage } from "@typeberry/block/work-package.js";
import { WorkPackageSpec, WorkReport } from "@typeberry/block/work-report.js";
import { WorkExecResult, WorkExecResultKind, WorkRefineLoad, WorkResult } from "@typeberry/block/work-result.js";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { codec, Encoder } from "@typeberry/codec";
import { asKnownSize, FixedSizeArray, type KnownSizeArray } from "@typeberry/collections";
import type { ChainSpec, PvmBackend } from "@typeberry/config";
import type { StatesDb } from "@typeberry/database";
import { PvmExecutor, type RefineHostCallExternalities } from "@typeberry/executor";
import { type Blake2b, HASH_SIZE, type WithHash } from "@typeberry/hash";
import { Logger } from "@typeberry/logger";
import { tryAsU8, tryAsU16, tryAsU32 } from "@typeberry/numbers";
import { ReturnStatus, type ReturnValue } from "@typeberry/pvm-host-calls";
import type { State } from "@typeberry/state";
import { FetchExternalities } from "@typeberry/transition/externalities/fetch-externalities.js";
import { assertNever, Result } from "@typeberry/utils";
import { RefineExternalitiesImpl } from "./externalities/refine.js";

export type RefineResult = {
  report: WorkReport;
  exports: PerWorkItem<Segment[]>;
};

export type RefineItemResult = {
  result: WorkResult;
  exports: Segment[];
};

export enum RefineError {
  /** State for context anchor block or lookup anchor is not found in the DB. */
  StateMissing = 0,
  /** Posterior state root of context anchor block does not match the one in the DB. */
  StateRootMismatch = 1,
  /** Lookup anchor state-slot does not match the one given in context. */
  InvalidLookupAnchorSlot = 2,
}

enum ServiceCodeError {
  /** Service id is not found in the state. */
  ServiceNotFound = 0,
  /** Expected service code does not match the state one. */
  ServiceCodeMismatch = 1,
  /** Code preimage missing. */
  ServiceCodeMissing = 2,
  /** Code blob is too big. */
  ServiceCodeTooBig = 3,
}

export type PerWorkItem<T> = KnownSizeArray<T, "for each work item">;

export type ImportedSegment = {
  index: SegmentIndex;
  data: Segment;
};

export type RefineState = Pick<State, "getService">;

const logger = Logger.new(import.meta.filename, "refine");

/** https://graypaper.fluffylabs.dev/#/ab2cdbd/2ffe002ffe00?v=0.7.2 */
const ARGS_CODEC = codec.object({
  core: codec.varU32.convert<CoreIndex>(
    (x) => tryAsU32(x),
    (x) => tryAsCoreIndex(x),
  ),
  workItemIndex: codec.varU32,
  serviceId: codec.varU32.asOpaque<ServiceId>(),
  payloadLength: codec.varU32,
  packageHash: codec.bytes(HASH_SIZE).asOpaque<WorkPackageHash>(),
});

export class Refine {
  constructor(
    public readonly chainSpec: ChainSpec,
    private readonly states: StatesDb,
    private readonly pvmBackend: PvmBackend,
    private readonly blake2b: Blake2b,
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
    workPackageAndHash: WithHash<WorkPackageHash, WorkPackage>,
    core: CoreIndex,
    imports: PerWorkItem<ImportedSegment>,
    extrinsics: PerWorkItem<WorkItemExtrinsic[]>,
  ): Promise<Result<RefineResult, RefineError>> {
    const workPackageHash = workPackageAndHash.hash;
    const workPackage = workPackageAndHash.data;
    const context = workPackage.context;
    // TODO [ToDr] Verify BEEFY when we have it
    // TODO [ToDr] Verify prerequisites
    logger.log`[core:${core}] Attempting to refine work package with ${workPackage.items.length} items.`;

    // TODO [ToDr] GP link
    // Verify anchor block
    const state = this.states.getState(context.anchor);
    if (state === null) {
      return Result.error(RefineError.StateMissing, () => `State at anchor block ${context.anchor} is missing.`);
    }

    const stateRoot = await this.states.getStateRoot(state);
    if (stateRoot.isEqualTo(context.stateRoot)) {
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

    // TODO [ToDr] Check authorization?

    logger.log`[core:${core}] Proceeding with work items verification. Anchor=${context.anchor}`;

    const refineResults: Awaited<ReturnType<Refine["refineItem"]>>[] = [];
    // Verify the work items
    for (const [idx, item] of workPackage.items.entries()) {
      logger.info`[core:${core}][i:${idx}] Refining item for service ${item.service}.`;

      refineResults.push(await this.refineItem(state, idx, item, imports, extrinsics, core, workPackageHash));
    }

    // amalgamate the work report now

    const exports = refineResults.map((x) => x.exports);
    const results = refineResults.map((x) => x.result);

    // TODO [ToDr] Compute erasure root
    const erasureRoot = Bytes.zero(HASH_SIZE);
    // TODO [ToDr] Compute exports root
    const exportsRoot = Bytes.zero(HASH_SIZE).asOpaque();
    const exportsCount = exports.reduce((acc, x) => acc + x.length, 0);

    const segmentRootLookup = [WorkPackageInfo.create({})];

    return Result.ok({
      report: WorkReport.create({
        workPackageSpec: WorkPackageSpec.create({
          length,
          hash: workPackageHash,
          erasureRoot,
          exportsRoot,
          // safe to convert, since we have limit on number of
          // exports per item and a limit for number of items
          exportsCount: tryAsU16(exportsCount),
        }),
        context: workPackage.context,
        coreIndex: core,
        // TODO [ToDr] authorization
        authorizerHash,
        authorizationGasUsed,
        authorizationOutput: workPackage.authorization,
        segmentRootLookup,
        results: FixedSizeArray.new(results, tryAsU8(refineResults.length)),
      }),
      exports: asKnownSize(exports),
    });
  }

  private async refineItem(
    state: State,
    idx: number,
    item: WorkItem,
    imports: PerWorkItem<ImportedSegment>,
    extrinsics: PerWorkItem<WorkItemExtrinsic[]>,
    core: CoreIndex,
    workPackageHash: WorkPackageHash,
  ): Promise<RefineItemResult> {
    const payloadHash = this.blake2b.hashBytes(item.payload);
    const baseResult = {
      serviceId: item.service,
      codeHash: item.codeHash,
      payloadHash,
      gas: item.refineGasLimit,
    };
    const baseLoad = {
      importedSegments: tryAsU32(imports.length),
      extrinsicCount: tryAsU32(extrinsics.length),
      extrinsicSize: tryAsU32(extrinsics.reduce((acc, x) => acc + x.length, 0)),
    };
    const maybeCode = this.getServiceCode(state, idx, item);

    if (maybeCode.isError) {
      const error =
        maybeCode.error === ServiceCodeError.ServiceCodeTooBig
          ? WorkExecResultKind.codeOversize
          : WorkExecResultKind.badCode;
      return {
        exports: [],
        result: WorkResult.create({
          ...baseResult,
          result: WorkExecResult.error(error),
          load: WorkRefineLoad.create({
            ...baseLoad,
            gasUsed: tryAsServiceGas(item.refineGasLimit),
            exportedSegments: tryAsU32(0),
          }),
        }),
      };
    }

    const code = maybeCode.ok;
    const externalities = this.createRefineExternalities({
      payload: item.payload,
      imports,
      extrinsics,
    });

    const executor = await PvmExecutor.createRefineExecutor(item.service, code, externalities, this.pvmBackend);

    const args = Encoder.encodeObject(ARGS_CODEC, {
      serviceId: item.service,
      core,
      workItemIndex: tryAsU32(idx),
      payloadLength: tryAsU32(item.payload.length),
      packageHash: workPackageHash,
    });

    const execResult = await executor.run(args, item.refineGasLimit);

    const result = this.extractWorkResult(execResult);

    const exports: Segment[] = [];
    if (exports.length !== item.exportCount) {
      return {
        exports,
        result: WorkResult.create({
          ...baseResult,
          result: WorkExecResult.error(WorkExecResultKind.incorrectNumberOfExports),
          load: WorkRefineLoad.create({
            ...baseLoad,
            gasUsed: tryAsServiceGas(item.refineGasLimit),
            exportedSegments: tryAsU32(0),
          }),
        }),
      };
    }

    return {
      // TODO [ToDr] exports from externalities
      exports,
      result: WorkResult.create({
        ...baseResult,
        result,
        load: WorkRefineLoad.create({
          ...baseLoad,
          gasUsed: execResult.consumedGas,
          exportedSegments: tryAsU32(exports.length),
        }),
      }),
    };
  }
  extractWorkResult(execResult: ReturnValue) {
    if (execResult.status === ReturnStatus.OK) {
      const slice = execResult.memorySlice;
      // TODO [ToDr] Verify the output size and change digestTooBig?
      return WorkExecResult.ok(BytesBlob.blobFrom(slice));
    }

    switch (execResult.status) {
      case ReturnStatus.OOG:
        return WorkExecResult.error(WorkExecResultKind.outOfGas);
      case ReturnStatus.PANIC:
        return WorkExecResult.error(WorkExecResultKind.panic);
      default:
        assertNever(execResult);
    }
  }

  private getServiceCode(state: State, idx: number, item: WorkItem) {
    const serviceId = item.service;
    const service = state.getService(serviceId);
    // TODO [ToDr] GP link
    // missing service
    if (service === null) {
      return Result.error(
        ServiceCodeError.ServiceNotFound,
        () => `[i:${idx}] Service ${serviceId} is missing in state.`,
      );
    }

    // TODO [ToDr] GP link
    // TODO [ToDr] shall we rather use the old codehash instead
    if (service.getInfo().codeHash.isEqualTo(item.codeHash)) {
      return Result.error(
        ServiceCodeError.ServiceCodeMismatch,
        () =>
          `[i:${idx}] Service ${serviceId} has invalid code hash. Ours: ${service.getInfo().codeHash}, expected: ${item.codeHash}`,
      );
    }

    const code = service.getPreimage(item.codeHash.asOpaque());
    if (code === null) {
      return Result.error(
        ServiceCodeError.ServiceCodeMissing,
        () => `[i:${idx}] Code ${item.codeHash} for service ${serviceId} was not found.`,
      );
    }

    if (code.length > W_C) {
      return Result.error(
        ServiceCodeError.ServiceCodeTooBig,
        () =>
          `[i:${idx}] Code ${item.codeHash} for service ${serviceId} is too big! ${code.length} bytes vs ${W_C} bytes max.`,
      );
    }

    return Result.ok(code);
  }

  private createRefineExternalities(args: {
    payload: BytesBlob;
    imports: PerWorkItem<ImportedSegment>;
    extrinsics: PerWorkItem<WorkItemExtrinsic[]>;
  }): RefineHostCallExternalities {
    // TODO [ToDr] Pass all required fetch data
    const fetchExternalities = FetchExternalities.createForRefine(
      {
        entropy: undefined,
        ...args,
      },
      this.chainSpec,
    );
    const refine = RefineExternalitiesImpl.create();

    return {
      fetchExternalities,
      refine,
    };
  }
}
