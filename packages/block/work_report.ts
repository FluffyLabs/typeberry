import type { Bytes, BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, codec } from "@typeberry/codec";
import type { FixedSizeArray } from "@typeberry/collections";
import type { U16, U32 } from "@typeberry/numbers";
import type { Opaque } from "@typeberry/utils";
import { HASH_SIZE } from "./hash";
import { RefineContext } from "./refine_context";
import { WorkResult } from "./work_result";

export type CoreIndex = Opaque<U16, "CoreIndex[u16]">;

export class WorkPackageSpec {
  static Codec = codec.Class(WorkPackageSpec, {
    hash: codec.bytes(HASH_SIZE),
    len: codec.u32,
    erasureRoot: codec.bytes(HASH_SIZE),
    exportsRoot: codec.bytes(HASH_SIZE),
  });

  static fromCodec({ hash, len, erasureRoot, exportsRoot }: CodecRecord<WorkPackageSpec>) {
    return new WorkPackageSpec(hash, len, erasureRoot, exportsRoot);
  }

  constructor(
    public readonly hash: Bytes<typeof HASH_SIZE>,
    public readonly len: U32,
    public readonly erasureRoot: Bytes<typeof HASH_SIZE>,
    public readonly exportsRoot: Bytes<typeof HASH_SIZE>,
  ) {}
}

export class WorkReport {
  static Codec = codec.Class(WorkReport, {
    packageSpec: WorkPackageSpec.Codec,
    context: RefineContext.Codec,
    coreIndex: codec.u16.cast(),
    authorizerHash: codec.bytes(HASH_SIZE),
    authOutput: codec.blob,
    results: codec.sequenceVarLen(WorkResult.Codec).cast(),
  });

  static fromCodec({ packageSpec, context, coreIndex, authorizerHash, authOutput, results }: CodecRecord<WorkReport>) {
    return new WorkReport(packageSpec, context, coreIndex, authorizerHash, authOutput, results);
  }

  constructor(
    public readonly packageSpec: WorkPackageSpec,
    public readonly context: RefineContext,
    public readonly coreIndex: CoreIndex,
    public readonly authorizerHash: Bytes<32>,
    public readonly authOutput: BytesBlob,
    public readonly results: FixedSizeArray<WorkResult, 1 | 2 | 3 | 4>,
  ) {}
}
