import type { Bytes, BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, codec } from "@typeberry/codec";
import type { U16, U32 } from "@typeberry/numbers";
import type { TrieHash } from "@typeberry/trie";
import type { Opaque } from "@typeberry/utils";
import type { ServiceGas, ServiceId } from "./common";
import { HASH_SIZE } from "./hash";

type ExtrinsicHash = Opaque<Bytes<32>, "ExtrinsicHash">;

export class ImportSpec {
  static Codec = codec.Class(ImportSpec, {
    treeRoot: codec.bytes(HASH_SIZE).cast(),
    index: codec.u16,
  });

  static fromCodec({ treeRoot, index }: CodecRecord<ImportSpec>) {
    return new ImportSpec(treeRoot, index);
  }

  constructor(
    public readonly treeRoot: TrieHash,
    public readonly index: U16,
  ) {}
}

export class ExtrinsicSpec {
  static Codec = codec.Class(ExtrinsicSpec, {
    hash: codec.bytes(HASH_SIZE).cast(),
    len: codec.u32,
  });

  static fromCodec({ hash, len }: CodecRecord<ExtrinsicSpec>) {
    return new ExtrinsicSpec(hash, len);
  }

  constructor(
    public readonly hash: ExtrinsicHash,
    public readonly len: U32,
  ) {}
}

export class WorkItem {
  static Codec = codec.Class(WorkItem, {
    service: codec.u32.cast(),
    codeHash: codec.bytes(HASH_SIZE),
    payload: codec.blob,
    gasLimit: codec.u64.cast(),
    importSegments: codec.sequenceVarLen(ImportSpec.Codec),
    extrinsic: codec.sequenceVarLen(ExtrinsicSpec.Codec),
    exportCount: codec.u16,
  });

  static fromCodec({
    service,
    codeHash,
    payload,
    gasLimit,
    importSegments,
    extrinsic,
    exportCount,
  }: CodecRecord<WorkItem>) {
    return new WorkItem(service, codeHash, payload, gasLimit, importSegments, extrinsic, exportCount);
  }

  constructor(
    public readonly service: ServiceId,
    public readonly codeHash: Bytes<typeof HASH_SIZE>,
    public readonly payload: BytesBlob,
    public readonly gasLimit: ServiceGas,
    public readonly importSegments: ImportSpec[],
    public readonly extrinsic: ExtrinsicSpec[],
    public readonly exportCount: U16,
  ) {}
}
