import {
  type CoreIndex,
  type Segment,
  type SegmentIndex,
  type ServiceGas,
  type ServiceId,
  tryAsCoreIndex,
  tryAsServiceGas,
} from "@typeberry/block";
import { W_C } from "@typeberry/block/gp-constants.js";
import type { WorkPackageHash } from "@typeberry/block/refine-context.js";
import type { WorkItem, WorkItemExtrinsic } from "@typeberry/block/work-item.js";
import { WorkExecResult, WorkExecResultKind, WorkRefineLoad, WorkResult } from "@typeberry/block/work-result.js";
import { BytesBlob } from "@typeberry/bytes";
import { codec, Encoder } from "@typeberry/codec";
import type { KnownSizeArray } from "@typeberry/collections";
import type { ChainSpec, PvmBackend } from "@typeberry/config";
import { PvmExecutor, type RefineHostCallExternalities, ReturnStatus, type ReturnValue } from "@typeberry/executor";
import { type Blake2b, HASH_SIZE } from "@typeberry/hash";
import { tryAsU32 } from "@typeberry/numbers";
import type { State } from "@typeberry/state";
import { RefineFetchExternalities } from "@typeberry/transition/externalities/refine-fetch-externalities.js";
import { assertNever, Result } from "@typeberry/utils";
import { RefineExternalitiesImpl } from "./externalities/refine.js";

export type RefineItemResult = {
  result: WorkResult;
  exports: readonly Segment[];
};

export type PerWorkItem<T> = KnownSizeArray<T, "for each work item">;

export type ImportedSegment = {
  index: SegmentIndex;
  data: Segment;
};

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

/**
 * Refine PVM invocation (Psi_R).
 *
 * Executes a single work item's refinement logic.
 */
export class Refine {
  constructor(
    private readonly chainSpec: ChainSpec,
    private readonly pvmBackend: PvmBackend,
    private readonly blake2b: Blake2b,
  ) {}

  async invoke(
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
        exports: [],
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

    const result = Refine.extractWorkResult(execResult);

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

  static extractWorkResult(execResult: ReturnValue<ServiceGas>) {
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
    const fetchExternalities = RefineFetchExternalities.new(this.chainSpec);
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
