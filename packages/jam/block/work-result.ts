import { BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, codec } from "@typeberry/codec";
import { HASH_SIZE, type OpaqueHash } from "@typeberry/hash";
import type { U32 } from "@typeberry/numbers";
import { WithDebug } from "@typeberry/utils";
import type { ServiceGas, ServiceId } from "./common.js";
import type { CodeHash } from "./hash.js";

/** The tag to describe the [`WorkExecResult`] union. */
export enum WorkExecResultKind {
  /** Execution succesful. The result will be followed by an octet sequence. */
  ok = 0,
  /** `∞`: the machine went out-of-gas during execution. */
  outOfGas = 1,
  /** `☇`: unexpected program termination. */
  panic = 2,
  /** `⊚`: the number of exports made was invalidly reported. */
  incorrectNumberOfExports = 3,
  /** `⊖`: the size of the digest (refinement output) would cross the acceptable limit. */
  digestTooBig = 4,
  /** `BAD`: service code was not available for lookup in state. */
  badCode = 5,
  /** `BIG`: the code was too big (beyond the maximum allowed size `W_C`) */
  codeOversize = 6,
}

type WorkExecResultUnion =
  | { kind: WorkExecResultKind.ok; okBlob: BytesBlob }
  | { kind: WorkExecResultKind.outOfGas }
  | { kind: WorkExecResultKind.panic }
  | { kind: WorkExecResultKind.incorrectNumberOfExports }
  | { kind: WorkExecResultKind.digestTooBig }
  | { kind: WorkExecResultKind.badCode }
  | { kind: WorkExecResultKind.codeOversize };

/** The execution result of some work-package. */
export class WorkExecResult extends WithDebug {
  static Codec = codec
    .union<WorkExecResultKind, WorkExecResultUnion>("WorkExecResult", {
      [WorkExecResultKind.ok]: codec.object({ okBlob: codec.blob }),
      [WorkExecResultKind.outOfGas]: codec.object({}),
      [WorkExecResultKind.panic]: codec.object({}),
      [WorkExecResultKind.incorrectNumberOfExports]: codec.object({}),
      [WorkExecResultKind.digestTooBig]: codec.object({}),
      [WorkExecResultKind.badCode]: codec.object({}),
      [WorkExecResultKind.codeOversize]: codec.object({}),
    })
    .convert<WorkExecResult>(
      (x) => {
        if (x.kind === WorkExecResultKind.ok) {
          return { kind: WorkExecResultKind.ok, okBlob: x.okBlob ?? BytesBlob.empty() };
        }
        return { kind: x.kind };
      },
      (x) => new WorkExecResult(x.kind, x.kind === WorkExecResultKind.ok ? x.okBlob : null),
    );

  static ok(blob: BytesBlob) {
    return new WorkExecResult(WorkExecResultKind.ok, blob);
  }

  static error(kind: Exclude<WorkExecResultKind, WorkExecResultKind.ok>) {
    return new WorkExecResult(kind, null);
  }

  private constructor(
    /** The execution result tag. */
    public readonly kind: WorkExecResultKind,
    /** Optional octet sequence - available only if `kind === ok` */
    public readonly okBlob: BytesBlob | null = null,
  ) {
    super();
  }
}

/**
 * Five fields describing the level of activity which this workload
 * imposed on the core in bringing the output datum to bear.
 *
 * https://graypaper.fluffylabs.dev/#/68eaa1f/141300141b00?v=0.6.4
 * https://graypaper.fluffylabs.dev/#/68eaa1f/1a50001a5000?v=0.6.4
 */
export class WorkRefineLoad extends WithDebug {
  static Codec = codec.Class(WorkRefineLoad, {
    gasUsed: codec.varU64.asOpaque<ServiceGas>(),
    importedSegments: codec.varU32,
    extrinsicCount: codec.varU32,
    extrinsicSize: codec.varU32,
    exportedSegments: codec.varU32,
  });

  static create({
    gasUsed,
    importedSegments,
    extrinsicCount,
    extrinsicSize,
    exportedSegments,
  }: CodecRecord<WorkRefineLoad>) {
    return new WorkRefineLoad(gasUsed, importedSegments, extrinsicCount, extrinsicSize, exportedSegments);
  }

  private constructor(
    /** `u`:  actual amount of gas used during refinement */
    public readonly gasUsed: ServiceGas,
    /** `i`: number of segments imported from */
    public readonly importedSegments: U32,
    /** `x`: number of extrinsics used in computing the workload */
    public readonly extrinsicCount: U32,
    /** `z`: size of extrinsics used in computing the workload */
    public readonly extrinsicSize: U32,
    /** `e`: number of segments exported into */
    public readonly exportedSegments: U32,
  ) {
    super();
  }
}

/**
 * A result of execution of some work package.
 *
 * https://graypaper.fluffylabs.dev/#/68eaa1f/139501139501?v=0.6.4
 */
export class WorkResult {
  static Codec = codec.Class(WorkResult, {
    serviceId: codec.u32.asOpaque<ServiceId>(),
    codeHash: codec.bytes(HASH_SIZE).asOpaque<CodeHash>(),
    payloadHash: codec.bytes(HASH_SIZE),
    gas: codec.u64.asOpaque<ServiceGas>(),
    result: WorkExecResult.Codec,
    load: WorkRefineLoad.Codec,
  });

  static create({ serviceId, codeHash, payloadHash, gas, result, load }: CodecRecord<WorkResult>) {
    return new WorkResult(serviceId, codeHash, payloadHash, gas, result, load);
  }

  private constructor(
    /** `s`: Index of the service whose state is to be altered (refine already executed). */
    public readonly serviceId: ServiceId,
    /** `c`: Hash of the code of the service at the time of being reported. */
    public readonly codeHash: CodeHash,
    /**
     * `y`: Hash of the payload within the work item which was executed in the refine stage to give this result.
     *
     * It has no immediate relevance, but is something provided to the accumulation logic of the service.
     *
     * https://graypaper.fluffylabs.dev/#/579bd12/134701134701
     */
    public readonly payloadHash: OpaqueHash,
    /**
     * `g`: Gas prioritization ratio.
     *
     * Used when determining how much gas should be allocated to execute
     * of this item's accumulate.
     */
    public readonly gas: ServiceGas,
    /** `o`: The output or error of the execution of the code. */
    public readonly result: WorkExecResult,
    /**
     * `u, i, x, z, e`: fields describing the level of activity
     *                  which this workload imposed on the core in
     *                  bringing the output datum to bear.
     *
     * https://graypaper.fluffylabs.dev/#/68eaa1f/141300141500?v=0.6.4
     */
    public readonly load: WorkRefineLoad,
  ) {}
}
