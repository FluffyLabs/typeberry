import {
  type CodeHash,
  type CoreIndex,
  type Segment,
  type SegmentIndex,
  type ServiceGas,
  type ServiceId,
  tryAsCoreIndex,
  tryAsServiceGas,
} from "@typeberry/block";
import { G_I, W_A, W_C } from "@typeberry/block/gp-constants.js";
import {
  type AuthorizerHash,
  type RefineContext,
  type WorkPackageHash,
  WorkPackageInfo,
} from "@typeberry/block/refine-context.js";
import type { WorkItem, WorkItemExtrinsic } from "@typeberry/block/work-item.js";
import type { WorkPackage } from "@typeberry/block/work-package.js";
import { WorkPackageSpec, WorkReport } from "@typeberry/block/work-report.js";
import { WorkExecResult, WorkExecResultKind, WorkRefineLoad, WorkResult } from "@typeberry/block/work-result.js";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { codec, Encoder } from "@typeberry/codec";
import { asKnownSize, FixedSizeArray, type KnownSizeArray } from "@typeberry/collections";
import type { ChainSpec, PvmBackend } from "@typeberry/config";
import type { StatesDb } from "@typeberry/database";
import { PvmExecutor, type RefineHostCallExternalities, ReturnStatus, type ReturnValue } from "@typeberry/executor";
import { type Blake2b, HASH_SIZE, type WithHash } from "@typeberry/hash";
import { Logger } from "@typeberry/logger";
import { tryAsU8, tryAsU16, tryAsU32 } from "@typeberry/numbers";
import type { State } from "@typeberry/state";
import { IsAuthorizedFetchExternalities } from "@typeberry/transition/externalities/is-authorized-fetch-externalities.js";
import { RefineFetchExternalities } from "@typeberry/transition/externalities/refine-fetch-externalities.js";
import { assertEmpty, assertNever, Result } from "@typeberry/utils";
import { RefineExternalitiesImpl } from "./externalities/refine.js";

export type RefineResult = {
  report: WorkReport;
  exports: PerWorkItem<Segment[]>;
};

export type RefineItemResult = {
  result: WorkResult;
  exports: readonly Segment[];
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

enum AuthorizationError {
  /** BAD: authorizer code not found (service or preimage missing). */
  CodeNotFound = 0,
  /** BIG: authorizer code exceeds W_A limit. */
  CodeTooBig = 1,
  /** PANIC/OOG: PVM execution failed. */
  PvmFailed = 2,
}

type AuthorizationOk = {
  authorizerHash: AuthorizerHash;
  authorizationGasUsed: ServiceGas;
  authorizationOutput: BytesBlob;
};

export type PerWorkItem<T> = KnownSizeArray<T, "for each work item">;

export type ImportedSegment = {
  index: SegmentIndex;
  data: Segment;
};

const logger = Logger.new(import.meta.filename, "refine");

/** https://graypaper.fluffylabs.dev/#/ab2cdbd/2ffe002ffe00?v=0.7.2 */
const REFINE_ARGS_CODEC = codec.object({
  core: codec.varU32.convert<CoreIndex>(
    (x) => tryAsU32(x),
    (x) => tryAsCoreIndex(x),
  ),
  workItemIndex: codec.varU32,
  serviceId: codec.varU32.asOpaque<ServiceId>(),
  payloadLength: codec.varU32,
  packageHash: codec.bytes(HASH_SIZE).asOpaque<WorkPackageHash>(),
});
const AUTH_ARGS_CODEC = codec.object({
  coreIndex: codec.u16,
});

export class InCore {
  constructor(
    public readonly chainSpec: ChainSpec,
    private readonly states: StatesDb,
    private readonly pvmBackend: PvmBackend,
    private readonly blake2b: Blake2b,
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
    imports: PerWorkItem<ImportedSegment[]>,
    extrinsics: PerWorkItem<WorkItemExtrinsic[]>,
  ): Promise<Result<RefineResult, RefineError>> {
    const workPackageHash = workPackageAndHash.hash;
    const { context, authToken, authCodeHash, authCodeHost, authConfiguration, items, ...rest } =
      workPackageAndHash.data;
    assertEmpty(rest);

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

    // Check authorization
    const authResult = await this.authorizePackage(
      state,
      core,
      authToken,
      authCodeHost,
      authCodeHash,
      authConfiguration,
    );
    if (authResult.isError) {
      return Result.error(
        RefineError.AuthorizationError,
        () => `Authorization error: ${AuthorizationError[authResult.error]}: ${authResult.details()}.`,
      );
    }

    logger.log`[core:${core}] Authorized. Proceeding with work items verification. Anchor=${context.anchor}`;

    // Verify the work items
    let exportOffset = 0;
    const refineResults: Awaited<ReturnType<InCore["refineItem"]>>[] = [];
    for (const [idx, item] of items.entries()) {
      logger.info`[core:${core}][i:${idx}] Refining item for service ${item.service}.`;

      const result = await this.refineItem(
        state,
        lookupState,
        idx,
        item,
        imports,
        extrinsics,
        core,
        workPackageHash,
        exportOffset,
      );
      refineResults.push(result);
      exportOffset += result.exports.length;
    }

    // amalgamate the work report now
    return Result.ok(
      this.amalgamateWorkReport(asKnownSize(refineResults), authResult.ok, workPackageHash, context, core),
    );
  }

  private amalgamateWorkReport(
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

  /**
   * IsAuthorized invocation.
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/2e64002e6400?v=0.7.2
   */
  private async authorizePackage(
    state: State,
    coreIndex: CoreIndex,
    authToken: BytesBlob,
    authCodeHost: ServiceId,
    authCodeHash: CodeHash,
    authConfiguration: BytesBlob,
  ): Promise<Result<AuthorizationOk, AuthorizationError>> {
    // Look up the authorizer code from the auth code host service
    const service = state.getService(authCodeHost);
    // https://graypaper.fluffylabs.dev/#/ab2cdbd/2eca002eca00?v=0.7.2
    if (service === null) {
      return Result.error(
        AuthorizationError.CodeNotFound,
        () => `Auth code host service ${authCodeHost} not found in state.`,
      );
    }

    const code = service.getPreimage(authCodeHash.asOpaque());
    if (code === null) {
      return Result.error(
        AuthorizationError.CodeNotFound,
        () => `Auth code preimage ${authCodeHash} not found in service ${authCodeHost}.`,
      );
    }

    // BIG: code exceeds W_A
    // https://graypaper.fluffylabs.dev/#/ab2cdbd/2ed6002ed600?v=0.7.2
    if (code.length > W_A) {
      return Result.error(
        AuthorizationError.CodeTooBig,
        () => `Auth code is too big: ${code.length} bytes vs ${W_A} max.`,
      );
    }

    // Prepare fetch externalities and executor
    const fetchExternalities = new IsAuthorizedFetchExternalities(this.chainSpec, {
      authToken,
      authConfiguration,
    });
    const executor = await PvmExecutor.createIsAuthorizedExecutor(
      authCodeHost,
      code,
      { fetchExternalities },
      this.pvmBackend,
    );

    const args = Encoder.encodeObject(AUTH_ARGS_CODEC, {
      coreIndex,
    });

    // Run PVM with gas budget G_I
    const gasLimit = tryAsServiceGas(G_I);
    const execResult = await executor.run(args, gasLimit);

    if (execResult.status !== ReturnStatus.OK) {
      return Result.error(
        AuthorizationError.PvmFailed,
        () =>
          `IsAuthorized PVM ${ReturnStatus[execResult.status]} (gas used: ${execResult.consumedGas}).`,
      );
    }

    // Compute authorizer hash: H(code_hash ++ configuration)
    // https://graypaper.fluffylabs.dev/#/ab2cdbd/1b81011b8401?v=0.7.2
    const authorizerHash = this.blake2b.hashBlobs<AuthorizerHash>([authCodeHash, authConfiguration]);
    const authorizationOutput = BytesBlob.blobFrom(execResult.memorySlice);
    const authorizationGasUsed = tryAsServiceGas(execResult.consumedGas);

    return Result.ok({ authorizerHash, authorizationGasUsed, authorizationOutput });
  }

  private async refineItem(
    state: State,
    lookupState: State,
    idx: number,
    item: WorkItem,
    allImports: PerWorkItem<ImportedSegment[]>,
    allExtrinsics: PerWorkItem<WorkItemExtrinsic[]>,
    coreIndex: CoreIndex,
    workPackageHash: WorkPackageHash,
    exportOffset: number,
  ): Promise<RefineItemResult> {
    const payloadHash = this.blake2b.hashBytes(item.payload);
    const baseResult = {
      serviceId: item.service,
      codeHash: item.codeHash,
      payloadHash,
      gas: item.refineGasLimit,
    };
    const imports = allImports[idx];
    const extrinsics = allExtrinsics[idx];
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
      imports: allImports,
      extrinsics: allExtrinsics,
      currentServiceId: item.service,
      lookupState,
      exportOffset,
    });

    const executor = await PvmExecutor.createRefineExecutor(item.service, code, externalities, this.pvmBackend);

    const args = Encoder.encodeObject(REFINE_ARGS_CODEC, {
      serviceId: item.service,
      core: coreIndex,
      workItemIndex: tryAsU32(idx),
      payloadLength: tryAsU32(item.payload.length),
      packageHash: workPackageHash,
    });

    const execResult = await executor.run(args, item.refineGasLimit);

    const exports = externalities.refine.getExportedSegments();
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

    const result = this.extractWorkResult(execResult);

    return {
      exports,
      result: WorkResult.create({
        ...baseResult,
        result,
        load: WorkRefineLoad.create({
          ...baseLoad,
          gasUsed: tryAsServiceGas(execResult.consumedGas),
          exportedSegments: tryAsU32(exports.length),
        }),
      }),
    };
  }

  extractWorkResult(execResult: ReturnValue<ServiceGas>) {
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
    if (!service.getInfo().codeHash.isEqualTo(item.codeHash)) {
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
    imports: PerWorkItem<ImportedSegment[]>;
    extrinsics: PerWorkItem<WorkItemExtrinsic[]>;
    currentServiceId: ServiceId;
    lookupState: State;
    exportOffset: number;
  }): RefineHostCallExternalities {
    // TODO [ToDr] Pass all required fetch data
    const fetchExternalities = new RefineFetchExternalities(this.chainSpec);
    const refine = RefineExternalitiesImpl.create({
      currentServiceId: args.currentServiceId,
      lookupState: args.lookupState,
      exportOffset: args.exportOffset,
      pvmBackend: this.pvmBackend,
    });

    return {
      fetchExternalities,
      refine,
    };
  }
}
