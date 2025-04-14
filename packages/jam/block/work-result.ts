import type { BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, codec } from "@typeberry/codec";
import { HASH_SIZE, type OpaqueHash } from "@typeberry/hash";
import { type U32, tryAsU32 } from "@typeberry/numbers";
import { WithDebug } from "@typeberry/utils";
import type { ServiceGas, ServiceId } from "./common";
import type { CodeHash } from "./hash";

/** The tag to describe the [`WorkExecResult`] union. */
export enum WorkExecResultKind {
  /** Execution succesful. The result will be followed by an octet sequence. */
  ok = 0,
  /** `∞`: the machine went out-of-gas during execution. */
  outOfGas = 1,
  /** `☇`: unexpected program termination. */
  panic = 2,
  /** `BAD`: service code was not available for lookup in state. */
  badCode = 3,
  /** `BIG`: the code was too big (beyond the maximum allowed size `W_C`) */
  codeOversize = 4,
}

export class WorkRefineLoad extends WithDebug {
  static Codec = codec.Class(WorkRefineLoad, {
    gasUsed: codec.u32,
    imports: codec.u32,
    extrinsicCount: codec.u32,
    extrinsicSize: codec.u32,
    exports: codec.u32,
  });
  static fromCodec({ gasUsed, imports, extrinsicCount, extrinsicSize, exports }: CodecRecord<WorkRefineLoad>) {
    return new WorkRefineLoad(gasUsed, imports, extrinsicCount, extrinsicSize, exports);
  }
  constructor(
    public readonly gasUsed: U32,
    public readonly imports: U32,
    public readonly extrinsicCount: U32,
    public readonly extrinsicSize: U32,
    public readonly exports: U32,
  ) {
    super();
  }
}

/** The execution result of some work-package. */
export class WorkExecResult extends WithDebug {
  static Codec = codec.custom<WorkExecResult>(
    {
      name: "WorkExecResult",
      sizeHint: { bytes: 1, isExact: false },
    },
    (e, x) => {
      e.varU32(tryAsU32(x.kind));
      if (x.kind === WorkExecResultKind.ok && x.okBlob !== null) {
        e.bytesBlob(x.okBlob);
      }
    },
    (d) => {
      const kind = d.varU32();
      if (kind === WorkExecResultKind.ok) {
        const blob = d.bytesBlob();
        return new WorkExecResult(kind, blob);
      }

      if (kind > WorkExecResultKind.codeOversize) {
        throw new Error(`Invalid WorkExecResultKind: ${kind}`);
      }

      return new WorkExecResult(kind);
    },
    (s) => {
      const kind = s.decoder.varU32();
      if (kind === WorkExecResultKind.ok) {
        s.bytesBlob();
      }
    },
  );

  constructor(
    /** The execution result tag. */
    public readonly kind: WorkExecResultKind,
    /** Optional octet sequence - available only if `kind === ok` */
    public readonly okBlob: BytesBlob | null = null,
  ) {
    super();
  }
}

/**
 * A result of execution of some work package.
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/133f01134401
 */
export class WorkResult {
  static Codec = codec.Class(WorkResult, {
    serviceId: codec.u32.asOpaque(),
    codeHash: codec.bytes(HASH_SIZE).asOpaque(),
    payloadHash: codec.bytes(HASH_SIZE),
    gas: codec.u64.asOpaque(),
    result: WorkExecResult.Codec,
  });

  static fromCodec({ serviceId, codeHash, payloadHash, gas, result }: CodecRecord<WorkResult>) {
    return new WorkResult(serviceId, codeHash, payloadHash, gas, result);
  }

  constructor(
    /** `s`: Index of the service whose state is to be altered (refine already executed). */
    public readonly serviceId: ServiceId,
    /** `c`: Hash of the code of the service at the time of being reported. */
    public readonly codeHash: CodeHash,
    /**
     * `l`: Hash of the payload within the work item which was executed in the refine stage to give this result.
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
  ) {}
}
