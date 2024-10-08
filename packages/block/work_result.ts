import type { Bytes, BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, codec } from "@typeberry/codec";
import type { U32, U64 } from "@typeberry/numbers";
import type { Opaque } from "@typeberry/utils";
import { HASH_SIZE } from "./hash";
import type { ServiceId } from "./preimage";

export type Gas = Opaque<U64, "Gas[u64]">;

// TODO [ToDr] Check the values!
export enum WorkExecResultKind {
  ok = 0,
  outOfGas = 1,
  panic = 2,
  badCode = 3,
  codeOversize = 4,
}

export class WorkExecResult {
  static Codec = codec.Class(WorkExecResult, {
    kind: codec.varU32,
    // TODO [ToDr] This should be only decoded IF kind === 0
    okBlob: codec.optional(codec.blob),
  });

  static fromCodec({ kind, okBlob }: CodecRecord<WorkExecResult>) {
    return new WorkExecResult(kind, okBlob);
  }

  constructor(
    public readonly kind: U32,
    public readonly okBlob: BytesBlob | null = null,
  ) {}
}

export class WorkResult {
  static Codec = codec.Class(WorkResult, {
    service: codec.u32.cast(),
    codeHash: codec.bytes(HASH_SIZE),
    payloadHash: codec.bytes(HASH_SIZE),
    gasRatio: codec.u64.cast(),
    result: WorkExecResult.Codec,
  });

  static fromCodec({ service, codeHash, payloadHash, gasRatio, result }: CodecRecord<WorkResult>) {
    return new WorkResult(service, codeHash, payloadHash, gasRatio, result);
  }

  constructor(
    public readonly service: ServiceId,
    public readonly codeHash: Bytes<typeof HASH_SIZE>,
    public readonly payloadHash: Bytes<typeof HASH_SIZE>,
    public readonly gasRatio: Gas,
    public readonly result: WorkExecResult,
  ) {}
}
