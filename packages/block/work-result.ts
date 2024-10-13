import type { Bytes, BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, codec } from "@typeberry/codec";
import type { U32 } from "@typeberry/numbers";
import type { ServiceGas, ServiceId } from "./common";
import { type CodeHash, HASH_SIZE } from "./hash";

export enum WorkExecResultKind {
  ok = 0,
  outOfGas = 1,
  panic = 2,
  badCode = 3,
  codeOversize = 4,
}

export class WorkExecResult {
  static Codec = codec.custom<WorkExecResult>(
    {
      name: "WorkExecResult",
      sizeHintBytes: 1,
    },
    (e, x) => {
      e.varU32(x.kind);
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
    public readonly kind: U32,
    public readonly okBlob: BytesBlob | null = null,
  ) {}
}

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
    public readonly service: ServiceId,
    public readonly codeHash: CodeHash,
    public readonly payloadHash: Bytes<typeof HASH_SIZE>,
    public readonly gasRatio: ServiceGas,
    public readonly result: WorkExecResult,
  ) {}
}
