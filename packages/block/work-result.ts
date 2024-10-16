import type { Bytes, BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, codec } from "@typeberry/codec";
import type { U32 } from "@typeberry/numbers";
import { type ServiceGas, type ServiceId, WithDebug } from "./common";
import { type CodeHash, HASH_SIZE } from "./hash";

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

/** The execution result of some work-package. */
export class WorkExecResult extends WithDebug {
  static Codec = codec.custom<WorkExecResult>(
    {
      name: "WorkExecResult",
      sizeHintBytes: 1,
    },
    (e, x) => {
      e.varU32(x.kind as number as U32);
      if (x.kind === WorkExecResultKind.ok && x.okBlob) {
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
 * https://graypaper.fluffylabs.dev/#/c71229b/131a01131f01
 */
export class WorkResult {
  static Codec = codec.Class(WorkResult, {
    service: codec.u32.cast(),
    codeHash: codec.bytes(HASH_SIZE).cast(),
    payloadHash: codec.bytes(HASH_SIZE),
    gasRatio: codec.u64.cast(),
    result: WorkExecResult.Codec,
  });

  static fromCodec({ service, codeHash, payloadHash, gasRatio, result }: CodecRecord<WorkResult>) {
    return new WorkResult(service, codeHash, payloadHash, gasRatio, result);
  }

  constructor(
    /** `s`: Index of the service whose state is to be altered (refine already executed). */
    public readonly service: ServiceId,
    /** `c`: Hash of the code of the service at the time of being reported. */
    public readonly codeHash: CodeHash,
    /**
     * `l`: Hash of the payload within the work item which was executed in the refine stage to give this result.
     *
     * It has no immediate relevance, but is something provided to the accumulation logic of the service.
     *
     * https://graypaper.fluffylabs.dev/#/c71229b/132201132201
     */
    public readonly payloadHash: Bytes<typeof HASH_SIZE>,
    /**
     * `g`: Gas prioritization ratio.
     *
     * Used when determining how much gas should be allocated to execute
     * of this item's accumulate.
     */
    public readonly gasRatio: ServiceGas,
    /** `o`: The output or error of the execution of the code. */
    public readonly result: WorkExecResult,
  ) {}
}
